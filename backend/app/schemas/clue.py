"""Clue schemas - clue tree only.

CRUD schemas removed - now handled via Supabase PostgREST.
Only clue tree schemas are kept here.
"""

from pydantic import BaseModel, Field


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
