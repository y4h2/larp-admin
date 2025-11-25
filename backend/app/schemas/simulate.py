"""Simulation schemas for request/response validation."""

from typing import Any

from pydantic import BaseModel, Field


class SimulateRequest(BaseModel):
    """Schema for simulation request."""

    script_id: str = Field(..., description="Script ID")
    npc_id: str = Field(..., description="NPC ID")
    player_message: str = Field(..., min_length=1, description="Player's message")
    unlocked_clue_ids: list[str] = Field(
        default_factory=list, description="Already unlocked clue IDs"
    )
    current_stage: int = Field(default=1, ge=1, description="Current story stage")


class MatchedClue(BaseModel):
    """Schema for a matched clue in simulation results."""

    clue_id: str
    name: str
    clue_type: str
    score: float = Field(ge=0.0, le=1.0, description="Match score")
    match_reasons: list[str] = Field(
        default_factory=list, description="Reasons for the match"
    )
    keyword_matches: list[str] = Field(
        default_factory=list, description="Matched keywords"
    )
    embedding_similarity: float | None = Field(
        None, description="Embedding similarity score"
    )
    is_triggered: bool = Field(
        default=False, description="Whether clue was actually triggered"
    )


class SimulateResponse(BaseModel):
    """Schema for simulation response."""

    matched_clues: list[MatchedClue] = Field(
        default_factory=list, description="All matched clues with details"
    )
    triggered_clues: list[MatchedClue] = Field(
        default_factory=list, description="Final triggered clues"
    )
    debug_info: dict[str, Any] = Field(
        default_factory=dict, description="Debug information"
    )
