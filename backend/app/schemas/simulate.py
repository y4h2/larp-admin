"""Simulation schemas for request/response validation."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class VectorBackendOverride(str, Enum):
    """Vector backend options."""

    CHROMA = "chroma"


class EmbeddingOptionsOverride(BaseModel):
    """Override options for embedding models."""

    similarity_threshold: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Override similarity threshold (0.0-1.0)",
    )
    vector_backend: VectorBackendOverride | None = Field(
        default=None,
        description="Override vector backend (only chroma supported)",
    )


class ChatOptionsOverride(BaseModel):
    """Override options for chat models."""

    temperature: float | None = Field(
        default=None,
        ge=0.0,
        le=2.0,
        description="Override temperature (0.0-2.0)",
    )
    max_tokens: int | None = Field(
        default=None,
        ge=1,
        le=32000,
        description="Override max tokens",
    )
    score_threshold: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Override LLM matching score threshold (0.0-1.0)",
    )


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
    npc_clue_template_id: str | None = Field(
        default=None,
        description="System prompt template ID for NPC when clues are triggered",
    )
    npc_no_clue_template_id: str | None = Field(
        default=None,
        description="System prompt template ID for NPC when no clues are triggered",
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
    username: str | None = Field(
        default=None,
        max_length=64,
        description="Username of who initiated the dialogue",
    )
    save_log: bool = Field(
        default=True,
        description="Whether to save this dialogue to logs",
    )
    # Runtime options override (for debugging/testing)
    embedding_options_override: EmbeddingOptionsOverride | None = Field(
        default=None,
        description="Override embedding options (e.g., similarity_threshold)",
    )
    chat_options_override: ChatOptionsOverride | None = Field(
        default=None,
        description="Override chat options (e.g., temperature, max_tokens)",
    )
    # LLM matching options
    llm_return_all_scores: bool = Field(
        default=False,
        description="For LLM matching: return scores for all clues, not just matched ones",
    )


class LLMTokenUsage(BaseModel):
    """Token usage from a single LLM call."""

    prompt_tokens: int | None = Field(default=None, description="Prompt tokens used")
    completion_tokens: int | None = Field(
        default=None, description="Completion tokens used"
    )
    total_tokens: int | None = Field(default=None, description="Total tokens used")


class LLMUsageInfo(BaseModel):
    """LLM usage metrics for the simulation request."""

    matching_tokens: LLMTokenUsage | None = Field(
        default=None, description="Token usage for clue matching"
    )
    matching_latency_ms: float | None = Field(
        default=None, description="Latency for clue matching in milliseconds"
    )
    matching_model: str | None = Field(
        default=None, description="Model used for matching"
    )
    npc_tokens: LLMTokenUsage | None = Field(
        default=None, description="Token usage for NPC response generation"
    )
    npc_latency_ms: float | None = Field(
        default=None, description="Latency for NPC response in milliseconds"
    )
    npc_model: str | None = Field(
        default=None, description="Model used for NPC response"
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
    llm_usage: LLMUsageInfo | None = Field(
        default=None, description="LLM token usage and latency metrics"
    )
    log_id: str | None = Field(
        default=None, description="ID of saved dialogue log"
    )
