"""Clue schemas for API endpoints."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ClueResponse(BaseModel):
    """Schema for Clue response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    script_id: str
    npc_id: str
    name: str
    type: str
    detail: str
    detail_for_npc: str
    trigger_keywords: list[str]
    trigger_semantic_summary: str
    prereq_clue_ids: list[str]
    created_at: datetime
    updated_at: datetime


class ClueCreate(BaseModel):
    """Schema for creating a clue."""

    script_id: str = Field(..., description="Script ID this clue belongs to")
    npc_id: str = Field(..., description="NPC ID who knows this clue")
    name: str = Field(..., min_length=1, max_length=255)
    type: Literal["text", "image"] = "text"
    detail: str = ""
    detail_for_npc: str = ""
    trigger_keywords: list[str] = Field(default_factory=list)
    trigger_semantic_summary: str = ""
    prereq_clue_ids: list[str] = Field(default_factory=list)


class ClueUpdate(BaseModel):
    """Schema for updating a clue."""

    name: str | None = Field(None, min_length=1, max_length=255)
    type: Literal["text", "image"] | None = None
    detail: str | None = None
    detail_for_npc: str | None = None
    trigger_keywords: list[str] | None = None
    trigger_semantic_summary: str | None = None
    prereq_clue_ids: list[str] | None = None
    npc_id: str | None = None


# Clue Tree schemas

class ClueTreeNode(BaseModel):
    """Schema for a node in the clue tree."""

    id: str
    name: str
    type: str
    npc_id: str
    prereq_clue_ids: list[str] = Field(default_factory=list)
    dependent_clue_ids: list[str] = Field(default_factory=list)
    detail: str | None = None
    trigger_keywords: list[str] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


class ClueTreeEdge(BaseModel):
    """Schema for an edge in the clue tree."""

    source: str  # prerequisite clue id
    target: str  # dependent clue id


class ClueTreeIssues(BaseModel):
    """Schema for clue tree quality issues."""

    dead_clues: list[str] = Field(default_factory=list, description="Clue IDs that are unreachable")
    orphan_clues: list[str] = Field(default_factory=list, description="Clue IDs with no relations")
    cycles: list[list[str]] = Field(default_factory=list, description="List of detected cycles")


class ClueTreeResponse(BaseModel):
    """Schema for clue tree response."""

    nodes: list[ClueTreeNode]
    edges: list[ClueTreeEdge]
    issues: ClueTreeIssues = Field(default_factory=ClueTreeIssues)


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
