"""Main AI Story Assistant Service.

This service provides AI-powered story creation capabilities including:
- Truth generation from story settings
- Clue chain generation with logical validation
- NPC generation and clue assignment
- Detail generation for clues and NPCs
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.script import Script
from app.schemas.ai_assistant import (
    ClueChainSuggestion,
    DetailFillResponse,
    GenerateClueChainRequest,
    GenerateDetailsRequest,
    GenerateNPCsRequest,
    GenerateTruthRequest,
    NPCAssignmentResponse,
    StoryDraft,
    TruthOptionsResponse,
)

from .clue_chain_generator import ClueChainGenerator
from .detail_generator import DetailGenerator
from .npc_generator import NPCGenerator
from .script_builder import ScriptBuilder
from .truth_generator import TruthGenerator

logger = logging.getLogger(__name__)


class AIStoryAssistantService:
    """AI-powered story creation assistant.

    Orchestrates the story creation workflow:
    1. Generate truth options
    2. Generate clue chain
    3. Generate NPCs
    4. Generate details
    5. Create script from draft
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with database session."""
        self.db = db
        self._truth_generator = TruthGenerator(db)
        self._clue_chain_generator = ClueChainGenerator(db)
        self._npc_generator = NPCGenerator(db)
        self._detail_generator = DetailGenerator(db)
        self._script_builder = ScriptBuilder(db)

    # ========== Truth Generation ==========

    async def generate_truth_options(
        self,
        request: GenerateTruthRequest,
    ) -> TruthOptionsResponse:
        """
        Generate multiple truth options based on story setting.

        Args:
            request: Contains story setting and optional hints.

        Returns:
            Multiple truth options for user to choose from.
        """
        return await self._truth_generator.generate_options(request)

    # ========== Clue Chain Generation ==========

    async def generate_clue_chain(
        self,
        request: GenerateClueChainRequest,
    ) -> ClueChainSuggestion:
        """
        Generate a clue chain from truth using reverse reasoning.

        Args:
            request: Contains setting, truth, and optional existing chain.

        Returns:
            Complete clue chain with validation.
        """
        return await self._clue_chain_generator.generate(request)

    async def optimize_clue_chain(
        self,
        clue_chain: ClueChainSuggestion,
        focus: str | None = None,
        llm_config_id: str | None = None,
    ) -> ClueChainSuggestion:
        """Optimize an existing clue chain based on validation results."""
        return await self._clue_chain_generator.optimize(
            clue_chain, focus, llm_config_id
        )

    # ========== NPC Generation ==========

    async def generate_npcs(
        self,
        request: GenerateNPCsRequest,
    ) -> NPCAssignmentResponse:
        """
        Generate NPCs and assign clues to them.

        Args:
            request: Contains setting, truth, clue chain, and NPC count.

        Returns:
            List of NPCs with assigned clues.
        """
        return await self._npc_generator.generate(request)

    # ========== Detail Generation ==========

    async def generate_details(
        self,
        request: GenerateDetailsRequest,
    ) -> DetailFillResponse:
        """
        Generate detailed content for clues and NPCs.

        Args:
            request: Contains all previous generation results.

        Returns:
            Detailed content for clues and NPCs.
        """
        return await self._detail_generator.generate(request)

    # ========== Script Creation ==========

    async def create_script_from_draft(
        self,
        draft: StoryDraft,
    ) -> Script:
        """
        Create actual Script, NPCs, and Clues from a story draft.

        Args:
            draft: Complete story draft with all details.

        Returns:
            Created Script model.
        """
        return await self._script_builder.create_from_draft(draft)
