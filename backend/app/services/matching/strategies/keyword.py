"""Keyword-based matching strategy."""

import logging

from app.models.clue import Clue

from ..models import MatchContext, MatchResult
from .base import BaseStrategy

logger = logging.getLogger(__name__)


class KeywordStrategy(BaseStrategy):
    """Keyword-based clue matching strategy."""

    async def match(
        self,
        candidates: list[Clue],
        context: MatchContext,
    ) -> tuple[list[MatchResult], dict | None]:
        """
        Match clues using keyword matching.

        Args:
            candidates: List of candidate clues
            context: Match context with player message

        Returns:
            Tuple of (match results, None - no strategy-specific debug info)
        """
        results = []
        for clue in candidates:
            result = self._match_clue(clue, context)
            if result.score > 0:
                results.append(result)
        return results, None

    def _match_clue(self, clue: Clue, context: MatchContext) -> MatchResult:
        """Match a single clue against the context."""
        result = MatchResult(clue=clue)

        # Check keyword matching
        keyword_score, keyword_matches, keyword_reasons = self._check_keywords(
            clue.trigger_keywords, context.player_message
        )

        if keyword_score > 0:
            result.score = keyword_score
            result.keyword_matches = keyword_matches
            result.match_reasons = keyword_reasons

        return result

    def _check_keywords(
        self,
        trigger_keywords: list[str] | None,
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
