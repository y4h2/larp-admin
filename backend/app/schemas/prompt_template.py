"""PromptTemplate schemas for API endpoints."""

import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class TemplateResponse(BaseModel):
    """Schema for PromptTemplate response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None = None
    type: str
    content: str
    is_default: bool
    variables: list[str]
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class TemplateCreate(BaseModel):
    """Schema for creating a template."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    type: Literal["clue_embedding", "npc_system_prompt", "clue_reveal", "custom"]
    content: str
    is_default: bool = False

    def extract_variables(self) -> list[str]:
        """Extract variables from template content."""
        regex = r"\{([^}]+)\}"
        return list(set(re.findall(regex, self.content)))


class TemplateUpdate(BaseModel):
    """Schema for updating a template."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    type: Literal["clue_embedding", "npc_system_prompt", "clue_reveal", "custom"] | None = None
    content: str | None = None
    is_default: bool | None = None

    def extract_variables(self) -> list[str] | None:
        """Extract variables from template content if provided."""
        if self.content is None:
            return None
        regex = r"\{([^}]+)\}"
        return list(set(re.findall(regex, self.content)))


# Render-related schemas


class PromptSegment(BaseModel):
    """Segment of rendered template for color-coded display."""

    type: Literal["template", "variable"] = Field(
        ...,
        description="Segment type: 'template' for static content, 'variable' for substituted values",
    )
    content: str = Field(
        ...,
        description="The segment content",
    )
    variable_name: str | None = Field(
        None,
        description="Variable name if type is 'variable' (e.g., 'clue.name')",
    )


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
    segments: list[PromptSegment] = Field(
        default_factory=list,
        description="Segments of rendered content for color-coded display",
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
