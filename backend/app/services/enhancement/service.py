"""Main AI Enhancement Service.

Provides AI-powered content enhancement capabilities including:
- Clue detail polishing
- Trigger keyword suggestions
- Semantic summary generation
- NPC description enhancement
- Clue chain analysis
"""

import logging
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from .chain_analyzer import ChainAnalyzer
from .clue_enhancer import ClueEnhancer
from .npc_enhancer import NPCEnhancer

logger = logging.getLogger(__name__)


class AIEnhancementService:
    """AI-powered content enhancement service.

    Orchestrates enhancement operations for clues, NPCs, and clue chains.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with database session."""
        self.db = db
        self._clue_enhancer = ClueEnhancer(db)
        self._npc_enhancer = NPCEnhancer(db)
        self._chain_analyzer = ChainAnalyzer(db)

    # ========== Clue Enhancement ==========

    async def polish_clue_detail(
        self,
        clue_name: str,
        clue_detail: str,
        context: str | None = None,
        llm_config_id: str | None = None,
    ) -> str:
        """Polish and improve clue detail text."""
        return await self._clue_enhancer.polish_detail(
            clue_name, clue_detail, context, llm_config_id
        )

    async def polish_clue_detail_stream(
        self,
        clue_name: str,
        clue_detail: str,
        context: str | None = None,
        llm_config_id: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream polish clue detail text."""
        async for chunk in self._clue_enhancer.polish_detail_stream(
            clue_name, clue_detail, context, llm_config_id
        ):
            yield chunk

    async def suggest_trigger_keywords(
        self,
        clue_name: str,
        clue_detail: str,
        existing_keywords: list[str] | None = None,
        llm_config_id: str | None = None,
    ) -> list[str]:
        """Suggest trigger keywords for a clue."""
        return await self._clue_enhancer.suggest_trigger_keywords(
            clue_name, clue_detail, existing_keywords, llm_config_id
        )

    async def generate_semantic_summary(
        self,
        clue_name: str,
        clue_detail: str,
        llm_config_id: str | None = None,
    ) -> str:
        """Generate semantic summary for clue matching."""
        return await self._clue_enhancer.generate_semantic_summary(
            clue_name, clue_detail, llm_config_id
        )

    async def generate_semantic_summary_stream(
        self,
        clue_name: str,
        clue_detail: str,
        llm_config_id: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream semantic summary generation."""
        async for chunk in self._clue_enhancer.generate_semantic_summary_stream(
            clue_name, clue_detail, llm_config_id
        ):
            yield chunk

    # ========== NPC Enhancement ==========

    async def polish_npc_description(
        self,
        npc_name: str,
        field: str,
        content: str,
        context: str | None = None,
        llm_config_id: str | None = None,
    ) -> str:
        """Polish NPC description fields."""
        return await self._npc_enhancer.polish_description(
            npc_name, field, content, context, llm_config_id
        )

    async def polish_npc_description_stream(
        self,
        npc_name: str,
        field: str,
        content: str,
        context: str | None = None,
        llm_config_id: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream polish NPC description."""
        async for chunk in self._npc_enhancer.polish_description_stream(
            npc_name, field, content, context, llm_config_id
        ):
            yield chunk

    # ========== Chain Analysis ==========

    async def analyze_clue_chain(
        self,
        clues: list[dict],
        script_background: str | None = None,
        llm_config_id: str | None = None,
    ) -> dict:
        """Analyze clue chain logic and provide suggestions."""
        return await self._chain_analyzer.analyze(
            clues, script_background, llm_config_id
        )
