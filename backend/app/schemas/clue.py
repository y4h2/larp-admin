"""Clue schemas for request/response validation based on data/sample/clue.py."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ClueBase(BaseModel):
    """Base schema for Clue with common fields."""

    name: str = Field(..., min_length=1, max_length=255, description="Clue name/title")
    type: Literal["text", "image"] = Field(default="text", description="Content type")
    detail: str = Field(..., min_length=1, description="The clue content itself (线索本身)")
    detail_for_npc: str = Field(
        ..., min_length=1, description="Guidance for NPC on how to reveal this clue"
    )
    trigger_keywords: list[str] = Field(
        default_factory=list, description="Keywords for vector match"
    )
    trigger_semantic_summary: str = Field(
        default="", description="Semantic summary for vector match"
    )
    prereq_clue_ids: list[str] = Field(
        default_factory=list, description="Prerequisite clue IDs (前置线索)"
    )


class ClueCreate(ClueBase):
    """Schema for creating a new Clue."""

    script_id: str = Field(..., description="Script ID this clue belongs to")
    npc_id: str = Field(..., description="NPC ID who knows this clue")


class ClueUpdate(BaseModel):
    """Schema for updating an existing Clue."""

    name: str | None = Field(None, min_length=1, max_length=255)
    type: Literal["text", "image"] | None = None
    detail: str | None = Field(None, min_length=1)
    detail_for_npc: str | None = Field(None, min_length=1)
    trigger_keywords: list[str] | None = None
    trigger_semantic_summary: str | None = None
    prereq_clue_ids: list[str] | None = None
    npc_id: str | None = None


class ClueResponse(ClueBase):
    """Schema for Clue response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    script_id: str
    npc_id: str
    created_at: datetime
    updated_at: datetime


class ClueTreeNode(BaseModel):
    """Schema for a node in the clue tree."""

    id: str
    name: str
    type: str
    npc_id: str
    prereq_clue_ids: list[str] = Field(default_factory=list)


class ClueTreeEdge(BaseModel):
    """Schema for an edge in the clue tree."""

    source: str  # prerequisite clue id
    target: str  # dependent clue id


class ClueTreeResponse(BaseModel):
    """Schema for clue tree response."""

    nodes: list[ClueTreeNode]
    edges: list[ClueTreeEdge]


class ClueTreeValidation(BaseModel):
    """Schema for clue tree validation results."""

    is_valid: bool = Field(description="Whether the tree is valid (no cycles, no dead clues)")
    cycles: list[list[str]] = Field(default_factory=list, description="List of detected cycles")
    dead_clues: list[str] = Field(
        default_factory=list, description="Clue IDs that are unreachable"
    )
    orphan_clues: list[str] = Field(
        default_factory=list, description="Clue IDs with no relations"
    )
    warnings: list[str] = Field(default_factory=list, description="Warning messages")
