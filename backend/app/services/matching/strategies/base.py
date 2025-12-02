"""Base strategy for clue matching."""

from abc import ABC, abstractmethod

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clue import Clue

from ..models import MatchContext, MatchResult


class BaseStrategy(ABC):
    """Abstract base class for matching strategies."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the strategy with a database session."""
        self.db = db

    @abstractmethod
    async def match(
        self,
        candidates: list[Clue],
        context: MatchContext,
    ) -> tuple[list[MatchResult], dict | None]:
        """
        Match clues against the context.

        Args:
            candidates: List of candidate clues (already filtered by prerequisites)
            context: Match context with player message and configuration

        Returns:
            Tuple of (match results, debug info for strategy-specific data)
        """
        pass

    def _check_prerequisites(self, clue: Clue, context: MatchContext) -> bool:
        """Check if prerequisite clues are unlocked."""
        prereq_ids = clue.prereq_clue_ids or []
        for prereq_id in prereq_ids:
            if prereq_id not in context.unlocked_clue_ids:
                return False
        return True
