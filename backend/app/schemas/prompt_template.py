"""PromptTemplate schemas for request/response validation."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class PromptTemplateBase(BaseModel):
    """Base schema for PromptTemplate with common fields."""

    name: str = Field(
        ..., min_length=1, max_length=255, description="Template name"
    )
    description: str | None = Field(None, description="Template description")
    type: Literal["system", "npc_dialog", "clue_explain"] = Field(
        ..., description="Template type"
    )
    scope_type: Literal["global", "script", "npc"] = Field(
        default="global", description="Scope type"
    )
    scope_target_id: str | None = Field(
        None, description="Target ID for script/npc scope"
    )
    content: str = Field(
        ..., min_length=1, description="Template content with {var} placeholders"
    )
    variables_meta: dict[str, Any] = Field(
        default_factory=dict, description="Metadata about used variables"
    )
    status: Literal["draft", "active", "archived"] = Field(
        default="draft", description="Template status"
    )


class PromptTemplateCreate(PromptTemplateBase):
    """Schema for creating a new PromptTemplate."""

    created_by: str | None = None


class PromptTemplateUpdate(BaseModel):
    """Schema for updating an existing PromptTemplate."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    type: Literal["system", "npc_dialog", "clue_explain"] | None = None
    scope_type: Literal["global", "script", "npc"] | None = None
    scope_target_id: str | None = None
    content: str | None = Field(None, min_length=1)
    variables_meta: dict[str, Any] | None = None
    status: Literal["draft", "active", "archived"] | None = None
    updated_by: str | None = None


class PromptTemplateResponse(PromptTemplateBase):
    """Schema for PromptTemplate response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    created_by: str | None
    created_at: datetime
    updated_by: str | None
    updated_at: datetime


class TemplateRenderRequest(BaseModel):
    """Request schema for rendering a template."""

    template_id: str | None = Field(None, description="Template ID to use")
    template_content: str | None = Field(
        None, description="Direct template content (overrides template_id)"
    )
    context: dict[str, Any] = Field(
        default_factory=dict, description="Context variables for rendering"
    )


class TemplateRenderResponse(BaseModel):
    """Response schema for rendered template."""

    rendered_content: str = Field(..., description="Rendered template content")
    warnings: list[str] = Field(
        default_factory=list, description="Warnings about unresolved variables"
    )
    unresolved_variables: list[str] = Field(
        default_factory=list, description="List of unresolved variable names"
    )


class VariableInfo(BaseModel):
    """Information about a template variable."""

    name: str = Field(..., description="Variable name (e.g., 'npc.name')")
    description: str = Field(..., description="Variable description")
    type: str = Field(..., description="Variable type (string, list, object)")
    example: str | None = Field(None, description="Example value")


class VariableCategory(BaseModel):
    """Category of template variables."""

    name: str = Field(..., description="Category name")
    description: str = Field(..., description="Category description")
    variables: list[VariableInfo] = Field(
        default_factory=list, description="Variables in this category"
    )


class AvailableVariablesResponse(BaseModel):
    """Response with all available template variables."""

    categories: list[VariableCategory] = Field(
        default_factory=list, description="Variable categories"
    )
