"""Script schemas for request/response validation."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class TruthSchema(BaseModel):
    """Schema for the truth of a murder mystery case."""

    murderer: str | None = Field(None, description="The murderer NPC ID or name")
    weapon: str | None = Field(None, description="The murder weapon")
    motive: str | None = Field(None, description="The motive for the crime")
    crime_method: str | None = Field(None, description="How the crime was committed")


class ScriptBase(BaseModel):
    """Base schema for Script with common fields."""

    name: str = Field(..., min_length=1, max_length=255, description="Script name")
    description: str | None = Field(None, description="Script description")
    summary: str | None = Field(None, description="Brief summary of the script story")
    background: str | None = Field(None, description="Background setting and context for the story")
    truth: dict[str, Any] = Field(
        default_factory=dict, description="The truth of the case: murderer, weapon, motive, crime_method"
    )
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
    summary: str | None = None
    background: str | None = None
    truth: dict[str, Any] | None = None
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
