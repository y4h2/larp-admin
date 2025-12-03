"""Main clue matching service."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clue import Clue
from app.schemas.simulate import (
    LLMTokenUsage,
    LLMUsageInfo,
    MatchedClue,
    MatchingStrategy,
    SimulateRequest,
    SimulateResponse,
)

from .models import (
    EmbeddingRenderedContent,
    LLMMatchPrompts,
    MatchContext,
    MatchResult,
    NpcResponseResult,
)
from .npc_response import NpcResponseGenerator
from .strategies import EmbeddingStrategy, KeywordStrategy, LLMStrategy

logger = logging.getLogger(__name__)


class MatchingService:
    """
    Service for matching player messages to clues.

    Implements multiple matching strategies:
    - keyword: Keyword-based matching
    - embedding: Vector similarity matching
    - llm: LLM-based semantic matching
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the service with a database session."""
        self.db = db
        self._keyword_strategy = KeywordStrategy(db)
        self._embedding_strategy = EmbeddingStrategy(db)
        self._llm_strategy = LLMStrategy(db)
        self._npc_generator = NpcResponseGenerator(db)

    async def simulate(self, request: SimulateRequest) -> SimulateResponse:
        """
        Simulate dialogue matching for a player message.

        Args:
            request: The simulation request with context and message.

        Returns:
            SimulateResponse with matched and triggered clues.
        """
        # Build match context
        context = MatchContext(
            player_message=request.player_message.lower(),
            unlocked_clue_ids=set(request.unlocked_clue_ids),
            npc_id=request.npc_id,
            script_id=request.script_id,
            matching_strategy=request.matching_strategy,
            template_id=request.template_id,
            llm_config_id=request.llm_config_id,
            npc_clue_template_id=request.npc_clue_template_id,
            npc_no_clue_template_id=request.npc_no_clue_template_id,
            npc_chat_config_id=request.npc_chat_config_id,
            session_id=request.session_id,
            embedding_options_override=request.embedding_options_override,
            chat_options_override=request.chat_options_override,
            llm_return_all_scores=request.llm_return_all_scores,
        )

        # Get all clues for this NPC
        all_clues = await self._get_candidate_clues(
            script_id=request.script_id,
            npc_id=request.npc_id,
        )

        # Categorize clues by prerequisites
        eligible_clues, excluded_clues = self._filter_by_prerequisites(
            all_clues, context
        )

        # Match clues using selected strategy
        results, strategy_debug = await self._match_with_strategy(
            eligible_clues, context, request.matching_strategy
        )

        # Sort by score
        results.sort(key=lambda r: r.score, reverse=True)

        # Determine threshold
        threshold = self._get_threshold(context, request.matching_strategy)

        # Determine triggered clues
        triggered = self._determine_triggered(
            results, threshold, request.matching_strategy
        )

        # Build response schemas
        matched_clues = [self._result_to_schema(r) for r in results]
        triggered_clues = [self._result_to_schema(r) for r in triggered]

        # Build candidate details for debug
        candidate_details = self._build_candidate_details(
            eligible_clues, results, strategy_debug
        )

        # Generate NPC response if configured
        npc_result = await self._maybe_generate_npc_response(
            context, triggered, request.player_message
        )

        # Build prompt_info for debug
        prompt_info = None
        if npc_result.system_prompt or npc_result.user_prompt:
            prompt_info = {
                "system_prompt": npc_result.system_prompt,
                "user_prompt": npc_result.user_prompt,
                "messages": npc_result.messages,
                "has_clue": npc_result.has_clue,
                "system_prompt_segments": [
                    {"type": seg.type, "content": seg.content, "variable_name": seg.variable_name}
                    for seg in npc_result.system_prompt_segments
                ] if npc_result.system_prompt_segments else None,
                "user_prompt_segments": [
                    {"type": seg.type, "content": seg.content, "variable_name": seg.variable_name}
                    for seg in npc_result.user_prompt_segments
                ] if npc_result.user_prompt_segments else None,
            }

        # Build LLM usage info from metrics
        llm_usage = self._build_llm_usage_info(strategy_debug, npc_result)

        return SimulateResponse(
            matched_clues=matched_clues,
            triggered_clues=triggered_clues,
            npc_response=npc_result.response,
            debug_info={
                "total_clues": len(all_clues),
                "total_candidates": len(eligible_clues),
                "total_excluded": len(excluded_clues),
                "total_matched": len(results),
                "total_triggered": len(triggered),
                "threshold": threshold,
                "strategy": request.matching_strategy.value,
                "candidates": candidate_details,
                "excluded": excluded_clues,
                "prompt_info": prompt_info,
            },
            llm_usage=llm_usage,
        )

    async def _get_candidate_clues(
        self,
        script_id: str,
        npc_id: str,
    ) -> list[Clue]:
        """Get candidate clues for matching."""
        query = (
            select(Clue)
            .where(Clue.script_id == script_id)
            .where(Clue.npc_id == npc_id)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    def _filter_by_prerequisites(
        self,
        all_clues: list[Clue],
        context: MatchContext,
    ) -> tuple[list[Clue], list[dict]]:
        """Filter clues by prerequisites."""
        eligible_clues: list[Clue] = []
        excluded_clues: list[dict] = []

        for clue in all_clues:
            prereq_ids = clue.prereq_clue_ids or []
            if not prereq_ids:
                eligible_clues.append(clue)
            else:
                missing_prereqs = [
                    pid for pid in prereq_ids
                    if pid not in context.unlocked_clue_ids
                ]
                if missing_prereqs:
                    excluded_clues.append({
                        "clue_id": clue.id,
                        "name": clue.name,
                        "reason": "prerequisites_not_met",
                        "missing_prereq_ids": missing_prereqs,
                    })
                else:
                    eligible_clues.append(clue)

        return eligible_clues, excluded_clues

    async def _match_with_strategy(
        self,
        candidates: list[Clue],
        context: MatchContext,
        strategy: MatchingStrategy,
    ) -> tuple[list[MatchResult], LLMMatchPrompts | EmbeddingRenderedContent | None]:
        """Match using the selected strategy."""
        if strategy == MatchingStrategy.LLM:
            return await self._llm_strategy.match(candidates, context)
        elif strategy == MatchingStrategy.EMBEDDING:
            return await self._embedding_strategy.match(candidates, context)
        else:
            return await self._keyword_strategy.match(candidates, context)

    def _get_threshold(
        self,
        context: MatchContext,
        strategy: MatchingStrategy,
    ) -> float:
        """Get score threshold based on strategy and overrides."""
        threshold = 0.5  # Default

        if strategy == MatchingStrategy.EMBEDDING:
            if (
                context.embedding_options_override
                and context.embedding_options_override.similarity_threshold is not None
            ):
                threshold = context.embedding_options_override.similarity_threshold
                logger.info(f"Using override similarity_threshold: {threshold}")
        elif strategy == MatchingStrategy.LLM:
            if (
                context.chat_options_override
                and context.chat_options_override.score_threshold is not None
            ):
                threshold = context.chat_options_override.score_threshold
                logger.info(f"Using override LLM score_threshold: {threshold}")

        return threshold

    def _determine_triggered(
        self,
        results: list[MatchResult],
        threshold: float,
        strategy: MatchingStrategy,
    ) -> list[MatchResult]:
        """Determine which clues are triggered."""
        if strategy == MatchingStrategy.LLM:
            # LLM: only trigger the single best match
            candidates_above_threshold = [r for r in results if r.score >= threshold]
            if candidates_above_threshold:
                best_match = max(candidates_above_threshold, key=lambda r: r.score)
                best_match.is_triggered = True
                logger.info(
                    f"LLM matching: selected best clue '{best_match.clue.name}' "
                    f"(score={best_match.score:.2f}) from {len(candidates_above_threshold)} candidates"
                )
                return [best_match]
            return []
        else:
            # Keyword/Embedding: trigger all above threshold
            triggered = [r for r in results if r.score >= threshold]
            for r in triggered:
                r.is_triggered = True
            return triggered

    def _build_candidate_details(
        self,
        eligible_clues: list[Clue],
        results: list[MatchResult],
        strategy_debug: LLMMatchPrompts | EmbeddingRenderedContent | None,
    ) -> list[dict]:
        """Build detailed candidate info for debug."""
        candidate_details = []
        for clue in eligible_clues:
            match_result = next((r for r in results if r.clue.id == clue.id), None)
            detail = {
                "clue_id": clue.id,
                "name": clue.name,
                "has_prereqs": bool(clue.prereq_clue_ids),
                "prereq_ids": clue.prereq_clue_ids or [],
                "trigger_keywords": clue.trigger_keywords or [],
                "trigger_semantic_summary": clue.trigger_semantic_summary or "",
                "score": match_result.score if match_result else 0.0,
                "matched": match_result is not None and match_result.score > 0,
                "triggered": match_result.is_triggered if match_result else False,
            }
            # Add LLM prompts for LLM strategy
            if isinstance(strategy_debug, LLMMatchPrompts):
                detail["llm_system_prompt"] = strategy_debug.system_prompt
                detail["llm_user_message"] = strategy_debug.user_message
                # Add segments for color-coded display
                if strategy_debug.system_prompt_segments:
                    detail["llm_system_prompt_segments"] = [
                        {
                            "type": seg.type,
                            "content": seg.content,
                            "variable_name": seg.variable_name,
                        }
                        for seg in strategy_debug.system_prompt_segments
                    ]
                if strategy_debug.user_message_segments:
                    detail["llm_user_message_segments"] = [
                        {
                            "type": seg.type,
                            "content": seg.content,
                            "variable_name": seg.variable_name,
                        }
                        for seg in strategy_debug.user_message_segments
                    ]
            # Add embedding rendered content and segments for embedding strategy
            if isinstance(strategy_debug, EmbeddingRenderedContent):
                if clue.id in strategy_debug.clue_contents:
                    detail["embedding_rendered_content"] = strategy_debug.clue_contents[clue.id]
                # Add segments for color-coded display
                if strategy_debug.clue_segments and clue.id in strategy_debug.clue_segments:
                    detail["embedding_rendered_segments"] = [
                        {
                            "type": seg.type,
                            "content": seg.content,
                            "variable_name": seg.variable_name,
                        }
                        for seg in strategy_debug.clue_segments[clue.id]
                    ]
            candidate_details.append(detail)
        return candidate_details

    async def _maybe_generate_npc_response(
        self,
        context: MatchContext,
        triggered: list[MatchResult],
        player_message: str,
    ) -> NpcResponseResult:
        """Generate NPC response if configured."""
        has_clue_template = context.npc_clue_template_id is not None
        has_no_clue_template = context.npc_no_clue_template_id is not None
        has_chat_config = context.npc_chat_config_id is not None

        if has_clue_template or has_no_clue_template or has_chat_config:
            logger.info(
                f"NPC reply params: clue_template_id={context.npc_clue_template_id}, "
                f"no_clue_template_id={context.npc_no_clue_template_id}, "
                f"chat_config_id={context.npc_chat_config_id}"
            )
            if (has_clue_template or has_no_clue_template) and has_chat_config:
                return await self._npc_generator.generate(
                    context=context,
                    triggered_clues=triggered,
                    player_message=player_message,
                )
            else:
                logger.warning(
                    "NPC reply skipped: at least one template and chat_config_id are required"
                )

        return NpcResponseResult()

    def _result_to_schema(self, result: MatchResult) -> MatchedClue:
        """Convert internal result to schema."""
        return MatchedClue(
            clue_id=result.clue.id,
            name=result.clue.name,
            clue_type=result.clue.type.value,
            score=result.score,
            match_reasons=result.match_reasons,
            keyword_matches=result.keyword_matches,
            embedding_similarity=result.embedding_similarity,
            is_triggered=result.is_triggered,
        )

    def _build_llm_usage_info(
        self,
        strategy_debug: LLMMatchPrompts | EmbeddingRenderedContent | None,
        npc_result: NpcResponseResult,
    ) -> LLMUsageInfo | None:
        """Build LLM usage info from metrics."""
        matching_tokens = None
        matching_latency_ms = None
        matching_model = None
        npc_tokens = None
        npc_latency_ms = None
        npc_model = None

        # Extract matching metrics (only for LLM strategy)
        if isinstance(strategy_debug, LLMMatchPrompts) and strategy_debug.metrics:
            metrics = strategy_debug.metrics
            matching_tokens = LLMTokenUsage(
                prompt_tokens=metrics.prompt_tokens,
                completion_tokens=metrics.completion_tokens,
                total_tokens=metrics.total_tokens,
            )
            matching_latency_ms = metrics.latency_ms
            matching_model = metrics.model

        # Extract NPC response metrics
        if npc_result.metrics:
            metrics = npc_result.metrics
            npc_tokens = LLMTokenUsage(
                prompt_tokens=metrics.prompt_tokens,
                completion_tokens=metrics.completion_tokens,
                total_tokens=metrics.total_tokens,
            )
            npc_latency_ms = metrics.latency_ms
            npc_model = metrics.model

        # Only return if we have any metrics
        if matching_tokens or npc_tokens:
            return LLMUsageInfo(
                matching_tokens=matching_tokens,
                matching_latency_ms=matching_latency_ms,
                matching_model=matching_model,
                npc_tokens=npc_tokens,
                npc_latency_ms=npc_latency_ms,
                npc_model=npc_model,
            )

        return None
