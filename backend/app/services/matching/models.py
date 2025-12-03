"""Data models for clue matching service."""

from dataclasses import dataclass, field

from pydantic import BaseModel, Field

from app.models.clue import Clue
from app.schemas.simulate import (
    ChatOptionsOverride,
    EmbeddingOptionsOverride,
    MatchingStrategy,
)


# Pydantic models for LLM structured output
class LLMClueMatch(BaseModel):
    """Single clue match from LLM."""

    id: str = Field(description="The clue ID")
    score: float = Field(ge=0.0, le=1.0, description="Match confidence score (0.0-1.0)")
    reason: str = Field(description="Reason for the match")


class LLMMatchResponse(BaseModel):
    """LLM matching response structure."""

    matches: list[LLMClueMatch] = Field(
        default_factory=list, description="List of matched clues"
    )


@dataclass
class PromptSegment:
    """A segment of a prompt with type information for UI rendering."""

    type: str  # "system", "template", "variable"
    content: str
    variable_name: str | None = None


@dataclass
class LLMMetrics:
    """LLM call metrics for tracking token usage and latency."""

    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    latency_ms: float | None = None
    model: str | None = None


@dataclass
class LLMMatchPrompts:
    """LLM matching prompts for debug info."""

    system_prompt: str
    user_message: str
    system_prompt_segments: list[PromptSegment] | None = None
    user_message_segments: list[PromptSegment] | None = None
    metrics: LLMMetrics | None = None


@dataclass
class EmbeddingRenderedContent:
    """Embedding rendered content for debug info - maps clue_id to rendered text and segments."""

    clue_contents: dict[str, str]  # clue_id -> rendered content
    clue_segments: dict[str, list[PromptSegment]] | None = None  # clue_id -> segments


@dataclass
class MatchContext:
    """Context for clue matching."""

    player_message: str
    unlocked_clue_ids: set[str]
    npc_id: str
    script_id: str
    matching_strategy: MatchingStrategy = MatchingStrategy.KEYWORD
    template_id: str | None = None
    llm_config_id: str | None = None
    # NPC reply configuration
    npc_clue_template_id: str | None = None  # Template when clues triggered
    npc_no_clue_template_id: str | None = None  # Template when no clues triggered
    npc_chat_config_id: str | None = None
    session_id: str | None = None
    # Runtime options override
    embedding_options_override: EmbeddingOptionsOverride | None = None
    chat_options_override: ChatOptionsOverride | None = None
    # LLM matching options
    llm_return_all_scores: bool = False


@dataclass
class MatchResult:
    """Result of matching a single clue."""

    clue: Clue
    score: float = 0.0
    match_reasons: list[str] = field(default_factory=list)
    keyword_matches: list[str] = field(default_factory=list)
    embedding_similarity: float | None = None
    is_triggered: bool = False


@dataclass
class NpcResponseResult:
    """Result of NPC response generation with prompt info."""

    response: str | None = None
    system_prompt: str | None = None
    user_prompt: str | None = None
    messages: list[dict] | None = None
    has_clue: bool = False  # Whether triggered clues were used
    system_prompt_segments: list[PromptSegment] | None = None
    user_prompt_segments: list[PromptSegment] | None = None
    metrics: LLMMetrics | None = None
