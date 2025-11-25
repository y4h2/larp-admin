"""Simulation schemas for request/response validation."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class MatchingStrategy(str, Enum):
    """Matching strategy for clue detection."""

    KEYWORD = "keyword"  # Keyword-based matching
    EMBEDDING = "embedding"  # Embedding similarity matching
    LLM = "llm"  # LLM-based matching (give all clues to LLM)


class SimulateRequest(BaseModel):
    """Schema for simulation request."""

    script_id: str = Field(..., description="Script ID")
    npc_id: str = Field(..., description="NPC ID")
    player_message: str = Field(..., min_length=1, description="Player's message")
    unlocked_clue_ids: list[str] = Field(
        default_factory=list, description="Already unlocked clue IDs"
    )
    current_stage: int = Field(default=1, ge=1, description="Current story stage")
    matching_strategy: MatchingStrategy = Field(
        default=MatchingStrategy.KEYWORD,
        description="Matching strategy: keyword, embedding, or llm",
    )
    template_id: str | None = Field(
        default=None,
        description="Prompt template ID (used for clue matching)",
    )
    llm_config_id: str | None = Field(
        default=None,
        description="LLM config ID for matching (embedding or chat)",
    )
    # NPC reply configuration
    npc_system_template_id: str | None = Field(
        default=None,
        description="System prompt template ID for NPC (role, personality)",
    )
    npc_chat_config_id: str | None = Field(
        default=None,
        description="LLM config ID for NPC chat",
    )
    # Session tracking
    session_id: str | None = Field(
        default=None,
        description="Session ID for grouping dialogue logs",
    )
    save_log: bool = Field(
        default=True,
        description="Whether to save this dialogue to logs",
    )


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
    npc_response: str | None = Field(
        default=None, description="NPC response to player message"
    )
    debug_info: dict[str, Any] = Field(
        default_factory=dict, description="Debug information"
    )
    log_id: str | None = Field(
        default=None, description="ID of saved dialogue log"
    )
