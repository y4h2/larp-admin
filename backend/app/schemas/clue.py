"""Clue schemas for request/response validation."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class KeywordCondition(BaseModel):
    """Keyword matching condition for clue unlock."""

    must_have: list[str] = Field(
        default_factory=list, description="Keywords that must all be present (AND)"
    )
    should_have: list[str] = Field(
        default_factory=list, description="Keywords where at least one must be present (OR)"
    )
    blacklist: list[str] = Field(
        default_factory=list, description="Keywords that must not be present"
    )
    min_matches: int = Field(default=1, ge=1, description="Minimum matches required")


class SemanticCondition(BaseModel):
    """Semantic matching condition for clue unlock."""

    target_queries: list[str] = Field(
        default_factory=list, description="Target queries for similarity matching"
    )
    threshold: float = Field(
        default=0.7, ge=0.0, le=1.0, description="Similarity threshold"
    )


class StateCondition(BaseModel):
    """State-based condition for clue unlock."""

    required_clues: list[str] = Field(
        default_factory=list, description="Required prerequisite clue IDs"
    )
    min_stage: int | None = Field(None, ge=1, description="Minimum story stage")
    max_stage: int | None = Field(None, ge=1, description="Maximum story stage")
    required_scene_id: str | None = Field(None, description="Required scene ID")


class UnlockConditions(BaseModel):
    """Complete unlock conditions for a clue."""

    keywords: KeywordCondition | None = None
    semantic: SemanticCondition | None = None
    state: StateCondition | None = None
    custom_script: str | None = Field(None, description="Custom condition script name")


class ClueEffects(BaseModel):
    """Effects triggered when a clue is unlocked."""

    display_text: str | None = Field(None, description="Text to display to player")
    unlock_clues: list[str] = Field(
        default_factory=list, description="Clue IDs to unlock"
    )
    advance_stage: int | None = Field(None, description="Advance to this stage")
    update_state: dict[str, Any] = Field(
        default_factory=dict, description="State updates"
    )


class ClueBase(BaseModel):
    """Base schema for Clue with common fields."""

    title_internal: str = Field(
        ..., min_length=1, max_length=255, description="Internal title for designers"
    )
    title_player: str = Field(
        ..., min_length=1, max_length=255, description="Title shown to players"
    )
    content_text: str = Field(..., min_length=1, description="Clue content text")
    content_type: Literal["text", "image", "structured"] = Field(
        default="text", description="Content type"
    )
    content_payload: dict[str, Any] = Field(
        default_factory=dict, description="Additional content data"
    )
    clue_type: Literal["evidence", "testimony", "world_info", "decoy"] = Field(
        ..., description="Type of clue"
    )
    importance: Literal["critical", "major", "minor", "easter_egg"] = Field(
        default="minor", description="Importance level"
    )
    stage: int = Field(default=1, ge=1, description="Story stage")
    npc_ids: list[str] = Field(default_factory=list, description="Related NPC IDs")
    unlock_conditions: dict[str, Any] = Field(
        default_factory=dict, description="Unlock conditions"
    )
    effects: dict[str, Any] = Field(
        default_factory=dict, description="Trigger effects"
    )
    one_time: bool = Field(default=False, description="Can only trigger once")


class ClueCreate(ClueBase):
    """Schema for creating a new Clue."""

    script_id: str = Field(..., description="Script ID")
    scene_id: str | None = Field(None, description="Scene ID (optional)")
    created_by: str | None = Field(None, max_length=255, description="Creator ID")


class ClueUpdate(BaseModel):
    """Schema for updating an existing Clue."""

    scene_id: str | None = None
    title_internal: str | None = Field(None, min_length=1, max_length=255)
    title_player: str | None = Field(None, min_length=1, max_length=255)
    content_text: str | None = Field(None, min_length=1)
    content_type: Literal["text", "image", "structured"] | None = None
    content_payload: dict[str, Any] | None = None
    clue_type: Literal["evidence", "testimony", "world_info", "decoy"] | None = None
    importance: Literal["critical", "major", "minor", "easter_egg"] | None = None
    stage: int | None = Field(None, ge=1)
    npc_ids: list[str] | None = None
    status: Literal["draft", "active", "disabled"] | None = None
    unlock_conditions: dict[str, Any] | None = None
    effects: dict[str, Any] | None = None
    one_time: bool | None = None
    updated_by: str | None = Field(None, max_length=255)


class ClueResponse(ClueBase):
    """Schema for Clue response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    script_id: str
    scene_id: str | None
    status: Literal["draft", "active", "disabled"]
    created_by: str | None
    created_at: datetime
    updated_by: str | None
    updated_at: datetime
    version: int


class ClueRelationCreate(BaseModel):
    """Schema for creating a clue relation."""

    prerequisite_clue_id: str = Field(..., description="Prerequisite clue ID")
    dependent_clue_id: str = Field(..., description="Dependent clue ID")
    relation_type: Literal["required", "optional"] = Field(
        default="required", description="Relation type"
    )


class ClueRelationResponse(BaseModel):
    """Schema for ClueRelation response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    prerequisite_clue_id: str
    dependent_clue_id: str
    relation_type: Literal["required", "optional"]


class ClueTreeNode(BaseModel):
    """Schema for a node in the clue tree."""

    id: str
    title_internal: str
    title_player: str
    clue_type: str
    importance: str
    stage: int
    status: str
    prerequisite_count: int = 0
    dependent_count: int = 0
    prerequisites: list[str] = Field(default_factory=list)
    dependents: list[str] = Field(default_factory=list)


class ClueTreeResponse(BaseModel):
    """Schema for clue tree response."""

    nodes: list[ClueTreeNode]
    edges: list[ClueRelationResponse]


class ClueTreeValidation(BaseModel):
    """Schema for clue tree validation results."""

    is_valid: bool
    cycles: list[list[str]] = Field(
        default_factory=list, description="Detected cycles"
    )
    dead_clues: list[str] = Field(
        default_factory=list, description="Unreachable clues"
    )
    orphan_clues: list[str] = Field(
        default_factory=list, description="Clues with no relations"
    )
    warnings: list[str] = Field(default_factory=list, description="Validation warnings")
