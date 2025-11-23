"""Script schemas for request/response validation."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ScriptBase(BaseModel):
    """Base schema for Script with common fields."""

    name: str = Field(..., min_length=1, max_length=255, description="Script name")
    description: str | None = Field(None, description="Script description")
    player_count: int = Field(default=1, ge=1, description="Number of players")
    expected_duration: int | None = Field(
        None, ge=1, description="Expected duration in minutes"
    )
    difficulty: Literal["easy", "medium", "hard"] = Field(
        default="medium", description="Script difficulty"
    )


class ScriptCreate(ScriptBase):
    """Schema for creating a new Script."""

    created_by: str | None = Field(None, max_length=255, description="Creator ID")


class ScriptUpdate(BaseModel):
    """Schema for updating an existing Script."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    status: Literal["draft", "test", "online"] | None = None
    player_count: int | None = Field(None, ge=1)
    expected_duration: int | None = Field(None, ge=1)
    difficulty: Literal["easy", "medium", "hard"] | None = None
    updated_by: str | None = Field(None, max_length=255)


class ScriptResponse(ScriptBase):
    """Schema for Script response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    status: Literal["draft", "test", "online"]
    version: int
    created_by: str | None
    created_at: datetime
    updated_by: str | None
    updated_at: datetime
    deleted_at: datetime | None = None


class ScriptListResponse(ScriptResponse):
    """Schema for Script in list response with additional counts."""

    scene_count: int = Field(default=0, description="Number of scenes")
    npc_count: int = Field(default=0, description="Number of NPCs")
    clue_count: int = Field(default=0, description="Number of clues")
