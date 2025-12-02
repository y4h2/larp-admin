"""Embedding-based matching strategy using vector similarity."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clue import Clue
from app.models.llm_config import LLMConfig
from app.models.prompt_template import PromptTemplate
from app.services.common import LLMConfigManager
from app.services.template import template_renderer
from app.services.vector_matching import create_vector_retriever

from ..models import EmbeddingRenderedContent, MatchContext, MatchResult, PromptSegment
from .base import BaseStrategy
from .keyword import KeywordStrategy

logger = logging.getLogger(__name__)


class EmbeddingStrategy(BaseStrategy):
    """Embedding-based clue matching strategy using vector similarity."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db)
        self._keyword_fallback = KeywordStrategy(db)

    async def match(
        self,
        candidates: list[Clue],
        context: MatchContext,
    ) -> tuple[list[MatchResult], EmbeddingRenderedContent | None]:
        """
        Match clues using embedding similarity with pgvector.

        Args:
            candidates: List of candidate clues
            context: Match context with player message

        Returns:
            Tuple of (match results, rendered content for debug info)
        """
        results = []
        rendered_content: EmbeddingRenderedContent | None = None

        # Get embedding config
        embedding_config = await self._get_llm_config_for_embedding(context.llm_config_id)
        if not embedding_config:
            logger.warning("No embedding config found, falling back to keyword matching")
            return await self._keyword_fallback.match(candidates, context)

        # Load template if specified
        template_content: str | None = None
        if context.template_id:
            template_content = await self._load_template_content(context.template_id)
            if template_content:
                logger.info(f"Using template {context.template_id} for embedding")

        if not candidates:
            return results, None

        # Render content for each candidate (for debug info)
        clue_contents: dict[str, str] = {}
        clue_segments: dict[str, list[PromptSegment]] = {}
        for clue in candidates:
            content, segments = self._render_clue_for_embedding(clue, template_content)
            clue_contents[clue.id] = content
            if segments:
                clue_segments[clue.id] = segments
        rendered_content = EmbeddingRenderedContent(
            clue_contents=clue_contents,
            clue_segments=clue_segments if clue_segments else None,
        )

        # Determine vector backend
        vector_backend = None
        if (
            context.embedding_options_override
            and context.embedding_options_override.vector_backend is not None
        ):
            vector_backend = context.embedding_options_override.vector_backend.value
            logger.info(f"Using override vector_backend: {vector_backend}")

        # Create vector retriever
        retriever = create_vector_retriever(
            embedding_config, db=self.db, backend=vector_backend
        )

        try:
            # Build embedding database
            await retriever.build_embedding_db(candidates, template_content)

            # Search for matching clues
            vector_results = await retriever.retrieve_clues(
                context.player_message,
                k=len(candidates),
                score_threshold=0.0,
            )

            # Convert to MatchResult
            for vr in vector_results:
                clue = retriever.get_clue(vr.clue_id)
                if clue:
                    result = MatchResult(
                        clue=clue,
                        score=vr.score,
                        embedding_similarity=vr.score,
                        match_reasons=[f"Embedding similarity: {vr.score:.3f}"],
                    )
                    if template_content:
                        result.match_reasons.append("Matched using template rendering")
                    results.append(result)

            logger.info(f"pgvector matching found {len(results)} results")

        except Exception as e:
            logger.error(f"Vector matching failed: {e}", exc_info=True)
            # Safe rollback - check session state first
            try:
                if self.db.is_active:
                    await self.db.rollback()
            except Exception as rollback_error:
                logger.warning(f"Rollback failed: {rollback_error}")
            # Fallback to keyword matching
            keyword_results, _ = await self._keyword_fallback.match(candidates, context)
            return keyword_results, None

        finally:
            try:
                await retriever.cleanup()
            except Exception as cleanup_error:
                logger.warning(f"Cleanup failed: {cleanup_error}")

        return results, rendered_content

    async def _get_llm_config_for_embedding(
        self, llm_config_id: str | None
    ) -> LLMConfig | None:
        """Get embedding config - prefer specified ID, otherwise use default."""
        return await LLMConfigManager.get_embedding_config(self.db, llm_config_id)

    async def _load_template_content(self, template_id: str | None) -> str | None:
        """Load template content by ID."""
        if not template_id:
            return None
        query = select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.deleted_at.is_(None),
        )
        result = await self.db.execute(query)
        template = result.scalars().first()
        return template.content if template else None

    def _render_clue_for_embedding(
        self,
        clue: Clue,
        template_content: str | None,
    ) -> tuple[str, list[PromptSegment] | None]:
        """Render clue content for embedding.

        Returns:
            Tuple of (rendered content, segments for color-coded display)
        """
        if template_content:
            clue_context = {
                "clue": {
                    "id": clue.id,
                    "name": clue.name,
                    "type": clue.type.value if clue.type else "text",
                    "detail": clue.detail or "",
                    "detail_for_npc": clue.detail_for_npc or "",
                    "trigger_keywords": clue.trigger_keywords or [],
                    "trigger_semantic_summary": clue.trigger_semantic_summary or "",
                }
            }
            render_result = template_renderer.render(template_content, clue_context)
            if not render_result.unresolved_variables:
                # Convert Pydantic PromptSegment to dataclass PromptSegment
                segments = [
                    PromptSegment(
                        type=seg.type,
                        content=seg.content,
                        variable_name=seg.variable_name,
                    )
                    for seg in render_result.segments
                ]
                return render_result.rendered_content, segments
            else:
                logger.warning(
                    f"Template has unresolved variables: {render_result.unresolved_variables}"
                )

        return clue.trigger_semantic_summary or clue.detail or clue.name, None
