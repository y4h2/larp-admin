"""NPC schemas for API endpoints."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NPCResponse(BaseModel):
    """Schema for NPC response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    script_id: str
    name: str
    age: int | None = None
    background: str | None = None
    personality: str | None = None
    knowledge_scope: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class NPCCreate(BaseModel):
    """Schema for creating an NPC."""

    script_id: str = Field(..., description="Script ID this NPC belongs to")
    name: str = Field(..., min_length=1, max_length=255)
    age: int | None = None
    background: str | None = None
    personality: str | None = None
    knowledge_scope: dict[str, Any] | None = Field(default_factory=dict)


class NPCUpdate(BaseModel):
    """Schema for updating an NPC."""

    name: str | None = Field(None, min_length=1, max_length=255)
    age: int | None = None
    background: str | None = None
    personality: str | None = None
    knowledge_scope: dict[str, Any] | None = None
