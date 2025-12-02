"""
AI Enhancement Module

This module provides AI-powered content enhancement capabilities:
- Clue detail polishing and improvement
- Trigger keyword suggestions
- Semantic summary generation for embedding matching
- NPC description enhancement
- Clue chain analysis and suggestions

Usage:
    from app.services.enhancement import AIEnhancementService

    service = AIEnhancementService(db)
    polished = await service.polish_clue_detail(clue_name, clue_detail)
"""

from .chain_analyzer import ChainAnalyzer
from .clue_enhancer import ClueEnhancer
from .llm_base import LLMBase
from .npc_enhancer import NPCEnhancer
from .service import AIEnhancementService

__all__ = [
    # Main service
    "AIEnhancementService",
    # Enhancers
    "ClueEnhancer",
    "NPCEnhancer",
    "ChainAnalyzer",
    # Base
    "LLMBase",
]
