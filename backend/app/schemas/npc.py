"""NPC schemas for request/response validation."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class NPCBase(BaseModel):
    """Base schema for NPC with common fields."""

    name: str = Field(..., min_length=1, max_length=255, description="NPC name")
    name_en: str | None = Field(None, max_length=255, description="English name")
    age: int | None = Field(None, ge=0, le=200, description="NPC age")
    job: str | None = Field(None, max_length=255, description="NPC job/occupation")
    role_type: Literal["suspect", "witness", "other"] = Field(
        default="other", description="Role type"
    )
    personality: str | None = Field(None, description="NPC personality traits")
    speech_style: str | None = Field(None, description="NPC speech style and mannerisms")
    background_story: str | None = Field(None, description="NPC background story")
    relations: dict[str, Any] = Field(
        default_factory=dict, description="Relationships with other NPCs"
    )
    system_prompt_template: str | None = Field(
        None, description="LLM system prompt template"
    )
    extra_prompt_vars: dict[str, Any] = Field(
        default_factory=dict, description="Extra prompt variables"
    )


class NPCCreate(NPCBase):
    """Schema for creating a new NPC."""

    script_id: str = Field(..., description="Script ID this NPC belongs to")
    created_by: str | None = Field(None, max_length=255, description="Creator ID")


class NPCUpdate(BaseModel):
    """Schema for updating an existing NPC."""

    name: str | None = Field(None, min_length=1, max_length=255)
    name_en: str | None = None
    age: int | None = Field(None, ge=0, le=200)
    job: str | None = None
    role_type: Literal["suspect", "witness", "other"] | None = None
    personality: str | None = None
    speech_style: str | None = None
    background_story: str | None = None
    relations: dict[str, Any] | None = None
    system_prompt_template: str | None = None
    extra_prompt_vars: dict[str, Any] | None = None
    status: Literal["active", "archived"] | None = None
    updated_by: str | None = Field(None, max_length=255)


class NPCResponse(NPCBase):
    """Schema for NPC response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    script_id: str
    status: Literal["active", "archived"]
    created_by: str | None
    created_at: datetime
    updated_by: str | None
    updated_at: datetime
