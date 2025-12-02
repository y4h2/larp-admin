"""
Clue Matching Service Module

This module provides clue matching functionality for dialogue simulation.
It supports three matching strategies:
- keyword: Simple keyword-based matching
- embedding: Vector similarity matching using embeddings
- llm: LLM-based semantic matching

Usage:
    from app.services.matching import MatchingService

    service = MatchingService(db)
    response = await service.simulate(request)
"""

from .models import (
    EmbeddingRenderedContent,
    LLMClueMatch,
    LLMMatchPrompts,
    LLMMatchResponse,
    MatchContext,
    MatchResult,
    NpcResponseResult,
    PromptSegment,
)
from .npc_response import NpcResponseGenerator
from .service import MatchingService
from .strategies import (
    BaseStrategy,
    EmbeddingStrategy,
    KeywordStrategy,
    LLMStrategy,
)

__all__ = [
    # Main service
    "MatchingService",
    # NPC response
    "NpcResponseGenerator",
    # Strategies
    "BaseStrategy",
    "KeywordStrategy",
    "EmbeddingStrategy",
    "LLMStrategy",
    # Models
    "MatchContext",
    "MatchResult",
    "NpcResponseResult",
    "LLMMatchPrompts",
    "LLMClueMatch",
    "LLMMatchResponse",
    "EmbeddingRenderedContent",
    "PromptSegment",
]
