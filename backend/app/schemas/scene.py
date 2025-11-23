"""Scene schemas for request/response validation."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SceneBase(BaseModel):
    """Base schema for Scene with common fields."""

    name: str = Field(..., min_length=1, max_length=255, description="Scene name")
    description: str | None = Field(None, description="Scene description")
    scene_type: Literal["investigation", "interrogation", "free_dialogue"] = Field(
        default="investigation", description="Type of scene"
    )


class SceneCreate(SceneBase):
    """Schema for creating a new Scene."""

    sort_order: int = Field(default=0, ge=0, description="Sort order")


class SceneUpdate(BaseModel):
    """Schema for updating an existing Scene."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    scene_type: Literal["investigation", "interrogation", "free_dialogue"] | None = None
    sort_order: int | None = Field(None, ge=0)


class SceneResponse(SceneBase):
    """Schema for Scene response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    script_id: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class SceneReorder(BaseModel):
    """Schema for reordering scenes."""

    scene_ids: list[str] = Field(
        ..., min_length=1, description="Ordered list of scene IDs"
    )
