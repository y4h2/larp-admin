"""PromptTemplate schemas for template rendering.

CRUD operations are now handled via Supabase PostgREST.
Only render-related schemas are kept here.
"""

from typing import Any

from pydantic import BaseModel, Field


class TemplateRenderRequest(BaseModel):
    """Request schema for rendering a template."""

    template_id: str | None = Field(
        None,
        description="Template ID to use",
    )
    template_content: str | None = Field(
        None,
        description="Direct template content (overrides template_id)",
    )
    context: dict[str, Any] = Field(
        default_factory=dict,
        description="Context with clue, npc, script objects for rendering",
    )


class TemplateRenderResponse(BaseModel):
    """Response schema for rendered template."""

    rendered_content: str = Field(
        ...,
        description="Rendered template content",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Warnings about unresolved variables",
    )
    unresolved_variables: list[str] = Field(
        default_factory=list,
        description="List of unresolved variable names",
    )


class VariableInfo(BaseModel):
    """Information about a template variable."""

    name: str = Field(..., description="Variable path (e.g., 'clue.name', 'npc.knowledge_scope.knows')")
    description: str = Field(..., description="Variable description")
    type: str = Field(..., description="Variable type (string, number, list, object)")
    example: str | None = Field(None, description="Example value")


class VariableCategory(BaseModel):
    """Category of template variables."""

    name: str = Field(..., description="Category name (clue, npc, script, etc.)")
    description: str = Field(..., description="Category description")
    variables: list[VariableInfo] = Field(default_factory=list, description="Variables in this category")


class AvailableVariablesResponse(BaseModel):
    """Response with all available template variables."""

    categories: list[VariableCategory] = Field(default_factory=list, description="Variable categories")
