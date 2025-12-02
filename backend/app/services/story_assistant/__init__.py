"""
AI Story Assistant Module

This module provides AI-powered story creation capabilities for murder mystery games:
- Truth generation from story settings
- Clue chain generation with logical validation
- NPC generation and clue assignment
- Detail generation for clues and NPCs
- Script creation from drafts

Usage:
    from app.services.story_assistant import AIStoryAssistantService

    service = AIStoryAssistantService(db)
    truth_options = await service.generate_truth_options(request)
"""

from .clue_chain_generator import ClueChainGenerator
from .detail_generator import DetailGenerator
from .llm_base import LLMBase
from .npc_generator import NPCGenerator
from .script_builder import ScriptBuilder
from .service import AIStoryAssistantService
from .truth_generator import TruthGenerator

__all__ = [
    # Main service
    "AIStoryAssistantService",
    # Generators
    "TruthGenerator",
    "ClueChainGenerator",
    "NPCGenerator",
    "DetailGenerator",
    "ScriptBuilder",
    # Base
    "LLMBase",
]
