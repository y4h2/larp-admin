"""Clue matching service for dialogue simulation."""

import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clue import Clue
from app.schemas.simulate import MatchedClue, SimulateRequest, SimulateResponse


@dataclass
class MatchContext:
    """Context for clue matching."""

    player_message: str
    unlocked_clue_ids: set[str]
    npc_id: str


@dataclass
class MatchResult:
    """Result of matching a single clue."""

    clue: Clue
    score: float = 0.0
    match_reasons: list[str] = field(default_factory=list)
    keyword_matches: list[str] = field(default_factory=list)
    embedding_similarity: float | None = None
    is_triggered: bool = False


class MatchingService:
    """
    Service for matching player messages to clues.

    Implements a keyword-based matching engine based on:
    - trigger_keywords: Keywords for matching
    - trigger_semantic_summary: Semantic summary for matching
    - prereq_clue_ids: Prerequisite clue checking
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the service with a database session."""
        self.db = db

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
        )

        # Get candidate clues for this NPC
        candidates = await self._get_candidate_clues(
            script_id=request.script_id,
            npc_id=request.npc_id,
        )

        # Match clues
        results = []
        for clue in candidates:
            result = self._match_clue(clue, context)
            if result.score > 0:
                results.append(result)

        # Sort by score
        results.sort(key=lambda r: r.score, reverse=True)

        # Determine triggered clues (score > threshold)
        threshold = 0.5
        triggered = [r for r in results if r.score >= threshold]
        for r in triggered:
            r.is_triggered = True

        # Build response
        matched_clues = [self._result_to_schema(r) for r in results]
        triggered_clues = [self._result_to_schema(r) for r in triggered]

        return SimulateResponse(
            matched_clues=matched_clues,
            triggered_clues=triggered_clues,
            debug_info={
                "total_candidates": len(candidates),
                "total_matched": len(results),
                "total_triggered": len(triggered),
                "threshold": threshold,
            },
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

    def _match_clue(
        self,
        clue: Clue,
        context: MatchContext,
    ) -> MatchResult:
        """Match a single clue against the context."""
        result = MatchResult(clue=clue)

        # Check prerequisite clues
        if not self._check_prerequisites(clue, context):
            return result

        # Check keyword matching
        keyword_score, keyword_matches, keyword_reasons = self._check_keywords(
            clue.trigger_keywords, context.player_message
        )

        if keyword_score > 0:
            result.score = keyword_score
            result.keyword_matches = keyword_matches
            result.match_reasons = keyword_reasons

        return result

    def _check_prerequisites(
        self,
        clue: Clue,
        context: MatchContext,
    ) -> bool:
        """Check if prerequisite clues are unlocked."""
        prereq_ids = clue.prereq_clue_ids or []
        for prereq_id in prereq_ids:
            if prereq_id not in context.unlocked_clue_ids:
                return False
        return True

    def _check_keywords(
        self,
        trigger_keywords: list[str],
        message: str,
    ) -> tuple[float, list[str], list[str]]:
        """
        Check keyword matching and return score.

        Returns:
            Tuple of (score, matched_keywords, reasons)
        """
        if not trigger_keywords:
            return 0.0, [], ["No trigger keywords defined"]

        matches: list[str] = []
        reasons: list[str] = []

        # Check each keyword
        for keyword in trigger_keywords:
            if keyword.lower() in message.lower():
                matches.append(keyword)

        if not matches:
            return 0.0, [], ["No keywords matched"]

        # Calculate score based on match ratio
        score = len(matches) / len(trigger_keywords)
        reasons.append(f"Matched {len(matches)}/{len(trigger_keywords)} keywords: {matches}")

        return score, matches, reasons

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
