"""Template rendering service for prompt templates.

Supports template syntax like '{{clue.name}}:{{clue.detail}}' with jsonpath-style
nested field access for clue, npc, script, and other objects.
"""

import re
from typing import Any

from app.schemas.prompt_template import (
    AvailableVariablesResponse,
    PromptSegment,
    TemplateRenderResponse,
)

from .formatters import format_value
from .variables import get_available_variables


class TemplateRenderer:
    """Service for rendering prompt templates with variable substitution.

    Supports jsonpath-style nested field access:
    - {{clue.name}} - simple field
    - {{clue.trigger_keywords}} - list field (numbered list by default)
    - {{npc.knowledge_scope.knows}} - nested field

    List formatting options (append |format to variable):
    - {{var}} or {{var|list}} - numbered list: "1. item1\\n2. item2" (default)
    - {{var|comma}} - comma-separated: "item1, item2"
    - {{var|bullet}} - bullet points: "• item1\\n• item2"
    - {{var|dash}} - dashed list: "- item1\\n- item2"
    - {{var|newline}} - newline-separated: "item1\\nitem2"

    Example:
        template = '{{clue.name}}:{{clue.detail}}'
        context = {'clue': {'name': 'Murder Weapon', 'detail': 'A knife...'}}
        render(template, context) -> 'Murder Weapon:A knife...'

        template = '{{npc.knowledge_scope.knows|comma}}'
        context = {'npc': {'knowledge_scope': {'knows': ['fact1', 'fact2']}}}
        render(template, context) -> 'fact1, fact2'
    """

    # Regex pattern for variable placeholders: {{var}} or {{var.path.to.field}} or {{var|format}}
    # Supports optional format suffix like {{var.path|comma}}, {{var.path|bullet}}, etc.
    VARIABLE_PATTERN = re.compile(
        r"\{\{([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)(?:\|([a-zA-Z_]+))?\}\}"
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
            template: Template string with {{var.path}} placeholders.
            context: Context dictionary with objects like clue, npc, script.
            strict: If True, keep unresolved placeholders; otherwise replace with empty.

        Returns:
            TemplateRenderResponse with rendered content, warnings, and segments.

        Example:
            template = '{{npc.name}} says: {{clue.detail}}'
            context = {
                'npc': {'name': 'John', 'age': 30},
                'clue': {'name': 'Evidence', 'detail': 'A bloody knife'}
            }
            # Result: 'John says: A bloody knife'
            # Segments: [
            #   {type: 'variable', content: 'John', variable_name: 'npc.name'},
            #   {type: 'template', content: ' says: '},
            #   {type: 'variable', content: 'A bloody knife', variable_name: 'clue.detail'}
            # ]
        """
        warnings: list[str] = []
        unresolved: list[str] = []
        segments: list[PromptSegment] = []

        # Track position as we iterate through matches
        last_end = 0
        rendered_parts: list[str] = []

        for match in self.VARIABLE_PATTERN.finditer(template):
            # Add static template content before this match
            if match.start() > last_end:
                static_content = template[last_end : match.start()]
                if static_content:
                    segments.append(PromptSegment(type="template", content=static_content))
                    rendered_parts.append(static_content)

            var_path = match.group(1)
            list_format = match.group(2)

            # Resolve the variable
            value = self._resolve_jsonpath(context, var_path)

            if value is None:
                # Variable not found
                unresolved.append(var_path)
                warnings.append(f"Variable not found: {{{{{var_path}}}}}")
                if strict:
                    # Keep original placeholder
                    segments.append(
                        PromptSegment(
                            type="variable",
                            content=match.group(0),
                            variable_name=var_path,
                            resolved=False,
                        )
                    )
                    rendered_parts.append(match.group(0))
                else:
                    # Replace with empty string
                    segments.append(
                        PromptSegment(
                            type="variable",
                            content="",
                            variable_name=var_path,
                            resolved=False,
                        )
                    )
                    rendered_parts.append("")
            else:
                # Format and add the resolved value
                formatted = format_value(value, list_format)
                segments.append(
                    PromptSegment(
                        type="variable",
                        content=formatted,
                        variable_name=var_path,
                        resolved=True,
                    )
                )
                rendered_parts.append(formatted)

            last_end = match.end()

        # Add any remaining static content after last match
        if last_end < len(template):
            remaining = template[last_end:]
            if remaining:
                segments.append(PromptSegment(type="template", content=remaining))
                rendered_parts.append(remaining)

        return TemplateRenderResponse(
            content="".join(rendered_parts),
            warnings=warnings,
            unresolved_variables=unresolved,
            segments=segments,
        )

    def _resolve_jsonpath(self, obj: Any, path: str) -> Any:
        """
        Resolve a jsonpath-style path against an object.

        Args:
            obj: Object to resolve path against (dict or object with attributes).
            path: Dot-separated path like "clue.detail" or "npc.knowledge_scope.knows".

        Returns:
            Resolved value or None if not found.
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
            elif hasattr(current, "__getitem__"):
                try:
                    current = current[part]
                except (KeyError, TypeError):
                    return None
            else:
                return None

        return current

    def extract_variables(self, template: str) -> list[str]:
        """
        Extract all variable names from a template.

        Args:
            template: Template string with {{var.path}} placeholders.

        Returns:
            List of unique variable paths found.
        """
        variables = set()
        for match in self.VARIABLE_PATTERN.finditer(template):
            variables.add(match.group(1))
        return sorted(variables)

    def validate_variables(
        self,
        template: str,
        allowed_roots: set[str] | None = None,
    ) -> tuple[bool, list[str]]:
        """
        Validate that all variables in a template are known.

        Args:
            template: Template string to validate.
            allowed_roots: Set of allowed root variable names (e.g., {'clue', 'npc', 'script'}).
                          If None, all roots are allowed.

        Returns:
            Tuple of (is_valid, list of error messages).
        """
        if allowed_roots is None:
            allowed_roots = {"clue", "npc", "script", "player_input", "now", "unlocked_clues"}

        variables = self.extract_variables(template)
        errors = []

        for var in variables:
            root = var.split(".")[0]
            if root not in allowed_roots:
                errors.append(
                    f"Unknown variable root: {{{{{var}}}}} (allowed: {', '.join(sorted(allowed_roots))})"
                )

        return len(errors) == 0, errors

    @staticmethod
    def get_available_variables() -> AvailableVariablesResponse:
        """Get all available template variables organized by category."""
        return get_available_variables()


# Singleton instance
template_renderer = TemplateRenderer()
