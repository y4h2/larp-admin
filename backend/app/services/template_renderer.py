"""Template rendering service for prompt templates."""

import re
from typing import Any

from app.schemas.prompt_template import (
    AvailableVariablesResponse,
    TemplateRenderResponse,
    VariableCategory,
    VariableInfo,
)


class TemplateRenderer:
    """Service for rendering prompt templates with variable substitution."""

    # Regex pattern for variable placeholders: {var} or {var.path}
    VARIABLE_PATTERN = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\}")

    # Maximum length for list rendering
    MAX_LIST_ITEMS = 50

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
            template: Template string with {var} placeholders.
            context: Context dictionary with variable values.
            strict: If True, raise error on unresolved variables.

        Returns:
            TemplateRenderResponse with rendered content and warnings.
        """
        warnings: list[str] = []
        unresolved: list[str] = []

        def replace_variable(match: re.Match) -> str:
            var_path = match.group(1)
            value = self._resolve_variable(var_path, context)

            if value is None:
                unresolved.append(var_path)
                if strict:
                    warnings.append(f"Unresolved variable: {{{var_path}}}")
                    return f"{{{var_path}}}"
                return ""

            return self._format_value(value, var_path)

        rendered = self.VARIABLE_PATTERN.sub(replace_variable, template)

        if unresolved:
            warnings.append(f"Unresolved variables: {', '.join(unresolved)}")

        return TemplateRenderResponse(
            rendered_content=rendered,
            warnings=warnings,
            unresolved_variables=unresolved,
        )

    def _resolve_variable(self, var_path: str, context: dict[str, Any]) -> Any:
        """
        Resolve a variable path from context.

        Args:
            var_path: Variable path like 'npc.name' or 'player_input'.
            context: Context dictionary.

        Returns:
            Resolved value or None if not found.
        """
        parts = var_path.split(".")
        value = context

        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            elif hasattr(value, part):
                value = getattr(value, part)
            else:
                return None

            if value is None:
                return None

        return value

    def _format_value(self, value: Any, var_path: str) -> str:
        """
        Format a value for template output.

        Args:
            value: Value to format.
            var_path: Variable path (used for special formatting rules).

        Returns:
            Formatted string.
        """
        # Handle list values (like unlocked_clues)
        if isinstance(value, list):
            return self._format_list(value, var_path)

        # Handle dict values
        if isinstance(value, dict):
            return self._format_dict(value, var_path)

        # Handle other values
        return str(value)

    def _format_list(self, items: list, var_path: str) -> str:
        """
        Format a list for template output.

        Args:
            items: List to format.
            var_path: Variable path for format selection.

        Returns:
            Formatted string.
        """
        # Limit list length
        if len(items) > self.MAX_LIST_ITEMS:
            items = items[: self.MAX_LIST_ITEMS]

        # Special formatting for clue lists
        if "clues" in var_path:
            lines = []
            for i, item in enumerate(items, 1):
                if isinstance(item, dict):
                    name = item.get("name", "")
                    detail = item.get("detail", "")[:100]
                    lines.append(f"[{i}] {name} - {detail}...")
                else:
                    lines.append(f"[{i}] {item}")
            return "\n".join(lines)

        # Default list formatting
        return "\n".join(f"- {item}" for item in items)

    def _format_dict(self, obj: dict, var_path: str) -> str:
        """
        Format a dict for template output.

        Args:
            obj: Dict to format.
            var_path: Variable path.

        Returns:
            Formatted string.
        """
        # For knowledge_scope, format as key-value pairs
        if "knowledge_scope" in var_path:
            lines = []
            for key, value in obj.items():
                if isinstance(value, list):
                    lines.append(f"- {key}: {', '.join(value)}")
                else:
                    lines.append(f"- {key}: {value}")
            return "\n".join(lines) if lines else "(none)"

        # Default dict formatting
        import json

        return json.dumps(obj, ensure_ascii=False, indent=2)

    def extract_variables(self, template: str) -> list[str]:
        """
        Extract all variable names from a template.

        Args:
            template: Template string.

        Returns:
            List of variable names.
        """
        return list(set(self.VARIABLE_PATTERN.findall(template)))

    def validate_template(
        self, template: str, available_vars: set[str] | None = None
    ) -> tuple[bool, list[str]]:
        """
        Validate a template for syntax and variable availability.

        Args:
            template: Template string.
            available_vars: Set of available variable names.

        Returns:
            Tuple of (is_valid, error_messages).
        """
        errors: list[str] = []
        variables = self.extract_variables(template)

        if available_vars:
            for var in variables:
                # Check if the base variable is available
                base_var = var.split(".")[0]
                if base_var not in available_vars and var not in available_vars:
                    errors.append(f"Unknown variable: {{{var}}}")

        return len(errors) == 0, errors

    @staticmethod
    def get_available_variables() -> AvailableVariablesResponse:
        """
        Get all available template variables organized by category.

        Returns:
            AvailableVariablesResponse with all variable categories.
        """
        categories = [
            VariableCategory(
                name="global",
                description="Global context variables",
                variables=[
                    VariableInfo(
                        name="player_input",
                        description="Current player input message",
                        type="string",
                        example="What happened last night?",
                    ),
                    VariableInfo(
                        name="script.id",
                        description="Script ID",
                        type="string",
                        example="abc-123",
                    ),
                    VariableInfo(
                        name="script.title",
                        description="Script title",
                        type="string",
                        example="Murder Mystery",
                    ),
                    VariableInfo(
                        name="script.summary",
                        description="Script summary",
                        type="string",
                        example="A thrilling murder mystery...",
                    ),
                    VariableInfo(
                        name="now",
                        description="Current timestamp",
                        type="string",
                        example="2024-01-15 10:30:00",
                    ),
                ],
            ),
            VariableCategory(
                name="npc",
                description="Current NPC variables",
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
                        example="A former butler who...",
                    ),
                    VariableInfo(
                        name="npc.personality",
                        description="NPC personality description",
                        type="string",
                        example="Nervous and secretive...",
                    ),
                    VariableInfo(
                        name="npc.knowledge_scope",
                        description="NPC knowledge scope",
                        type="object",
                        example='{"knows": [...], "does_not_know": [...]}',
                    ),
                ],
            ),
            VariableCategory(
                name="clue",
                description="Single clue variables (for clue explain templates)",
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
                        description="Clue type",
                        type="string",
                        example="text",
                    ),
                    VariableInfo(
                        name="clue.detail",
                        description="Clue detail content",
                        type="string",
                        example="A bloody knife was found...",
                    ),
                    VariableInfo(
                        name="clue.detail_for_npc",
                        description="Guidance for NPC on how to reveal this clue",
                        type="string",
                        example="The NPC should nervously describe...",
                    ),
                ],
            ),
            VariableCategory(
                name="clues_list",
                description="Clue list variables",
                variables=[
                    VariableInfo(
                        name="unlocked_clues",
                        description="List of already unlocked clues",
                        type="list",
                        example="[1] Clue A - content...\n[2] Clue B - content...",
                    ),
                    VariableInfo(
                        name="candidate_clues",
                        description="Candidate clues matched this turn",
                        type="list",
                        example="[1] Matched Clue - content...",
                    ),
                ],
            ),
        ]

        return AvailableVariablesResponse(categories=categories)


# Singleton instance
template_renderer = TemplateRenderer()
