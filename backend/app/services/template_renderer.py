"""Template rendering service for prompt templates.

Supports template syntax like '{clue.name}:{clue.detail}' with jsonpath-style
nested field access for clue, npc, script, and other objects.

Based on the render_clue_template pattern from data/sample/clue.py.
"""

import re
from dataclasses import asdict
from typing import Any

from app.schemas.prompt_template import (
    AvailableVariablesResponse,
    TemplateRenderResponse,
    VariableCategory,
    VariableInfo,
)


class TemplateRenderer:
    """Service for rendering prompt templates with variable substitution.

    Supports jsonpath-style nested field access:
    - {clue.name} - simple field
    - {clue.trigger_keywords} - list field (numbered list by default)
    - {npc.knowledge_scope.knows} - nested field

    List formatting options (append |format to variable):
    - {var} or {var|list} - numbered list: "1. item1\\n2. item2" (default)
    - {var|comma} - comma-separated: "item1, item2"
    - {var|bullet} - bullet points: "• item1\\n• item2"
    - {var|dash} - dashed list: "- item1\\n- item2"
    - {var|newline} - newline-separated: "item1\\nitem2"

    Example:
        template = '{clue.name}:{clue.detail}'
        context = {'clue': {'name': 'Murder Weapon', 'detail': 'A knife...'}}
        render(template, context) -> 'Murder Weapon:A knife...'

        template = '{npc.knowledge_scope.knows|comma}'
        context = {'npc': {'knowledge_scope': {'knows': ['fact1', 'fact2']}}}
        render(template, context) -> 'fact1, fact2'
    """

    # Regex pattern for variable placeholders: {var} or {var.path.to.field} or {var|format}
    # Supports optional format suffix like {var.path|comma}, {var.path|bullet}, etc.
    VARIABLE_PATTERN = re.compile(
        r"\{([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)(?:\|([a-zA-Z_]+))?\}"
    )

    def __init__(self) -> None:
        """Initialize the template renderer."""
        pass

    def render(
        self,
        template: str,
        context: dict[str, Any],
        strict: bool = False,
    ) -> TemplateRenderResponse:
        """
        Render a template with the given context.

        Args:
            template: Template string with {var.path} placeholders.
            context: Context dictionary with objects like clue, npc, script.
            strict: If True, keep unresolved placeholders; otherwise replace with empty.

        Returns:
            TemplateRenderResponse with rendered content and warnings.

        Example:
            template = '{npc.name} says: {clue.detail}'
            context = {
                'npc': {'name': 'John', 'age': 30},
                'clue': {'name': 'Evidence', 'detail': 'A bloody knife'}
            }
            # Result: 'John says: A bloody knife'
        """
        warnings: list[str] = []
        unresolved: list[str] = []

        def replace_match(match: re.Match) -> str:
            var_path = match.group(1)
            list_format = match.group(2)  # Optional format suffix (e.g., "comma", "bullet")
            value = self._resolve_jsonpath(context, var_path)

            if value is None:
                unresolved.append(var_path)
                if strict:
                    return match.group(0)  # Keep original placeholder
                return ""

            return self._format_value(value, list_format)

        rendered = self.VARIABLE_PATTERN.sub(replace_match, template)

        if unresolved:
            warnings.append(f"Unresolved variables: {', '.join(unresolved)}")

        return TemplateRenderResponse(
            rendered_content=rendered,
            warnings=warnings,
            unresolved_variables=unresolved,
        )

    def _resolve_jsonpath(self, obj: Any, path: str) -> Any:
        """
        Resolve a jsonpath-style path from an object.

        Supports nested access like 'npc.knowledge_scope.knows'.
        Works with dicts, objects with attributes, and dataclasses.

        Args:
            obj: The root object/dict to resolve from.
            path: Dot-separated path like 'clue.name' or 'npc.knowledge_scope.knows'.

        Returns:
            The resolved value, or None if not found.
        """
        parts = path.split(".")
        current = obj

        for part in parts:
            if current is None:
                return None

            if isinstance(current, dict):
                current = current.get(part)
            elif hasattr(current, part):
                current = getattr(current, part)
            elif hasattr(current, "__dataclass_fields__"):
                # Handle dataclass by converting to dict
                current = asdict(current).get(part)
            else:
                return None

        return current

    def _format_value(self, value: Any, list_format: str | None = None) -> str:
        """
        Format a value for template output.

        Args:
            value: Value to format.
            list_format: Format type for lists (list, comma, bullet, dash, newline).
                        Defaults to "list" (numbered list).

        Returns:
            Formatted string.
        """
        if value is None:
            return ""

        # Handle list values with format option
        if isinstance(value, list):
            return self._format_list(value, list_format or "list")

        # Handle dict values - convert to readable format
        if isinstance(value, dict):
            import json
            return json.dumps(value, ensure_ascii=False)

        return str(value)

    def _format_list(self, items: list, format_type: str) -> str:
        """
        Format a list according to the specified format type.

        Args:
            items: List of items to format.
            format_type: One of "list", "comma", "bullet", "dash", "newline".

        Returns:
            Formatted string.

        Supported formats:
            - list (default): Numbered list (1. item\\n2. item)
            - comma: Comma-separated (item1, item2)
            - bullet: Bullet points (• item\\n• item)
            - dash: Dashed list (- item\\n- item)
            - newline: Newline-separated (item\\nitem)
        """
        if not items:
            return ""

        str_items = [str(v) for v in items]

        if format_type == "comma":
            return ", ".join(str_items)
        elif format_type == "newline":
            return "\n".join(str_items)
        elif format_type == "bullet":
            return "\n".join(f"• {v}" for v in str_items)
        elif format_type == "dash":
            return "\n".join(f"- {v}" for v in str_items)
        else:  # "list" (default) - numbered list
            return "\n".join(f"{i + 1}. {v}" for i, v in enumerate(str_items))

    def extract_variables(self, template: str) -> list[str]:
        """
        Extract all variable paths from a template.

        Args:
            template: Template string.

        Returns:
            List of unique variable paths (without format suffixes).

        Example:
            extract_variables('{clue.name}:{clue.detail|comma}')
            # Returns: ['clue.name', 'clue.detail']
        """
        matches = self.VARIABLE_PATTERN.findall(template)
        # findall returns list of (var_path, format) tuples, extract only var_path
        return list(set(m[0] for m in matches))

    def validate_variables(
        self,
        template: str,
        allowed_roots: set[str] | None = None,
    ) -> tuple[bool, list[str]]:
        """
        Validate template variables against allowed root objects.

        Args:
            template: Template string.
            allowed_roots: Set of allowed root names (e.g., {'clue', 'npc', 'script'}).

        Returns:
            Tuple of (is_valid, error_messages).
        """
        if allowed_roots is None:
            allowed_roots = {"clue", "npc", "script", "player_input", "now", "unlocked_clues"}

        errors: list[str] = []
        variables = self.extract_variables(template)

        for var in variables:
            root = var.split(".")[0]
            if root not in allowed_roots:
                errors.append(f"Unknown variable root: {{{var}}} (allowed: {', '.join(sorted(allowed_roots))})")

        return len(errors) == 0, errors

    @staticmethod
    def get_available_variables() -> AvailableVariablesResponse:
        """
        Get all available template variables organized by category.

        These variables can be used in templates with jsonpath-style access.

        Returns:
            AvailableVariablesResponse with all variable categories.
        """
        categories = [
            VariableCategory(
                name="clue",
                description="Clue object fields - use {clue.field_name}",
                variables=[
                    VariableInfo(
                        name="clue.id",
                        description="Clue ID",
                        type="string",
                        example="clue-123",
                    ),
                    VariableInfo(
                        name="clue.name",
                        description="Clue name",
                        type="string",
                        example="Murder Weapon",
                    ),
                    VariableInfo(
                        name="clue.type",
                        description="Clue type (text/image)",
                        type="string",
                        example="text",
                    ),
                    VariableInfo(
                        name="clue.detail",
                        description="Clue detail content",
                        type="string",
                        example="A bloody knife was found under the bed...",
                    ),
                    VariableInfo(
                        name="clue.detail_for_npc",
                        description="Guidance for NPC on how to reveal this clue",
                        type="string",
                        example="Nervously mention finding something sharp...",
                    ),
                    VariableInfo(
                        name="clue.trigger_keywords",
                        description="Keywords that trigger this clue (list, numbered by default, use |comma for comma-separated)",
                        type="list",
                        example="1. knife\n2. weapon\n3. murder",
                    ),
                    VariableInfo(
                        name="clue.trigger_semantic_summary",
                        description="Semantic summary for matching",
                        type="string",
                        example="Player asks about the murder weapon",
                    ),
                ],
            ),
            VariableCategory(
                name="npc",
                description="NPC object fields - use {npc.field_name}",
                variables=[
                    VariableInfo(
                        name="npc.id",
                        description="NPC ID",
                        type="string",
                        example="npc-123",
                    ),
                    VariableInfo(
                        name="npc.name",
                        description="NPC name",
                        type="string",
                        example="John Smith",
                    ),
                    VariableInfo(
                        name="npc.age",
                        description="NPC age",
                        type="number",
                        example="45",
                    ),
                    VariableInfo(
                        name="npc.background",
                        description="NPC background story",
                        type="string",
                        example="A former butler who worked at the mansion...",
                    ),
                    VariableInfo(
                        name="npc.personality",
                        description="NPC personality description",
                        type="string",
                        example="Nervous and secretive, tends to avoid eye contact",
                    ),
                    VariableInfo(
                        name="npc.knowledge_scope.knows",
                        description="Things the NPC knows (list, numbered by default, use |comma for comma-separated)",
                        type="list",
                        example="1. saw the victim at 10pm\n2. heard a scream",
                    ),
                    VariableInfo(
                        name="npc.knowledge_scope.does_not_know",
                        description="Things the NPC doesn't know (list, numbered by default, use |comma for comma-separated)",
                        type="list",
                        example="1. who the murderer is\n2. where the weapon is",
                    ),
                    VariableInfo(
                        name="npc.knowledge_scope.world_model_limits",
                        description="Limits of NPC's world knowledge (list, numbered by default, use |comma for comma-separated)",
                        type="list",
                        example="1. doesn't know about modern technology",
                    ),
                ],
            ),
            VariableCategory(
                name="script",
                description="Script object fields - use {script.field_name}",
                variables=[
                    VariableInfo(
                        name="script.id",
                        description="Script ID",
                        type="string",
                        example="script-123",
                    ),
                    VariableInfo(
                        name="script.title",
                        description="Script title",
                        type="string",
                        example="Murder at the Manor",
                    ),
                    VariableInfo(
                        name="script.summary",
                        description="Script summary",
                        type="string",
                        example="A thrilling murder mystery set in Victorian England...",
                    ),
                    VariableInfo(
                        name="script.background",
                        description="Script background setting",
                        type="string",
                        example="The year is 1888, in a wealthy London mansion...",
                    ),
                    VariableInfo(
                        name="script.difficulty",
                        description="Script difficulty level",
                        type="string",
                        example="medium",
                    ),
                    VariableInfo(
                        name="script.truth.murderer",
                        description="The murderer (from truth object)",
                        type="string",
                        example="John Smith",
                    ),
                    VariableInfo(
                        name="script.truth.weapon",
                        description="The murder weapon (from truth object)",
                        type="string",
                        example="A kitchen knife",
                    ),
                    VariableInfo(
                        name="script.truth.motive",
                        description="The motive (from truth object)",
                        type="string",
                        example="Revenge for past betrayal",
                    ),
                    VariableInfo(
                        name="script.truth.crime_method",
                        description="How the crime was committed (from truth object)",
                        type="string",
                        example="Stabbed in the study at midnight",
                    ),
                ],
            ),
            VariableCategory(
                name="context",
                description="Context variables - use {variable_name}",
                variables=[
                    VariableInfo(
                        name="player_input",
                        description="Current player input message",
                        type="string",
                        example="What happened last night?",
                    ),
                    VariableInfo(
                        name="now",
                        description="Current timestamp",
                        type="string",
                        example="2024-01-15 10:30:00",
                    ),
                    VariableInfo(
                        name="unlocked_clues",
                        description="List of already unlocked clue names (numbered by default, use |comma for comma-separated)",
                        type="list",
                        example="1. Murder Weapon\n2. Alibi Letter\n3. Blood Stain",
                    ),
                ],
            ),
        ]

        return AvailableVariablesResponse(categories=categories)


# Singleton instance
template_renderer = TemplateRenderer()
