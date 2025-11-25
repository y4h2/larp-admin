"""PromptTemplate schemas for request/response validation.

Supports template syntax like '{clue.name}:{clue.detail}' with jsonpath-style
nested field access.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# Template types
TemplateTypeEnum = Literal["clue_embedding", "npc_system_prompt", "clue_reveal", "custom"]


class PromptTemplateBase(BaseModel):
    """Base schema for PromptTemplate."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Template display name",
    )
    description: str | None = Field(
        None,
        description="Template description",
    )
    type: TemplateTypeEnum = Field(
        ...,
        description="Template type/purpose",
    )
    content: str = Field(
        ...,
        min_length=1,
        description="Template content with {var.path} placeholders",
    )
    is_default: bool = Field(
        default=False,
        description="Whether this is the default template for its type",
    )


class PromptTemplateCreate(PromptTemplateBase):
    """Schema for creating a new PromptTemplate."""

    pass


class PromptTemplateUpdate(BaseModel):
    """Schema for updating an existing PromptTemplate."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    type: TemplateTypeEnum | None = None
    content: str | None = Field(None, min_length=1)
    is_default: bool | None = None


class PromptTemplateResponse(PromptTemplateBase):
    """Schema for PromptTemplate response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    variables: list[str] = Field(
        default_factory=list,
        description="Auto-extracted variable names from content",
    )
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


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
