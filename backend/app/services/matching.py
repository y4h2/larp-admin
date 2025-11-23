"""Clue matching service for dialogue simulation."""

import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.algorithm import AlgorithmStrategy
from app.models.clue import Clue, ClueStatus
from app.schemas.simulate import MatchedClue, SimulateRequest, SimulateResponse


@dataclass
class MatchContext:
    """Context for clue matching."""

    player_message: str
    unlocked_clue_ids: set[str]
    current_stage: int
    scene_id: str
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

    Implements a basic keyword-based matching engine with support for:
    - Keyword matching (must_have, should_have, blacklist)
    - Stage-based filtering
    - Prerequisite clue checking
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
        # Get strategy
        strategy = await self._get_strategy(request.strategy_id)
        strategy_id = strategy.id if strategy else "default"

        # Build match context
        context = MatchContext(
            player_message=request.player_message.lower(),
            unlocked_clue_ids=set(request.unlocked_clue_ids),
            current_stage=request.current_stage,
            scene_id=request.scene_id,
            npc_id=request.npc_id,
        )

        # Get candidate clues
        candidates = await self._get_candidate_clues(
            script_id=request.script_id,
            scene_id=request.scene_id,
            npc_id=request.npc_id,
            current_stage=request.current_stage,
        )

        # Match clues
        results = []
        for clue in candidates:
            result = self._match_clue(clue, context, strategy)
            if result.score > 0:
                results.append(result)

        # Sort by score
        results.sort(key=lambda r: r.score, reverse=True)

        # Determine triggered clues (score > threshold)
        threshold = self._get_trigger_threshold(strategy)
        triggered = [r for r in results if r.score >= threshold]
        for r in triggered:
            r.is_triggered = True

        # Build response
        matched_clues = [self._result_to_schema(r) for r in results]
        triggered_clues = [self._result_to_schema(r) for r in triggered]

        return SimulateResponse(
            matched_clues=matched_clues,
            triggered_clues=triggered_clues,
            strategy_used=strategy_id,
            debug_info={
                "total_candidates": len(candidates),
                "total_matched": len(results),
                "total_triggered": len(triggered),
                "threshold": threshold,
            },
        )

    async def _get_strategy(
        self, strategy_id: str | None
    ) -> AlgorithmStrategy | None:
        """Get the strategy by ID or return the default."""
        if strategy_id:
            result = await self.db.execute(
                select(AlgorithmStrategy).where(AlgorithmStrategy.id == strategy_id)
            )
            return result.scalars().first()

        # Get default strategy
        result = await self.db.execute(
            select(AlgorithmStrategy).where(AlgorithmStrategy.is_default == True)  # noqa: E712
        )
        return result.scalars().first()

    async def _get_candidate_clues(
        self,
        script_id: str,
        scene_id: str,
        npc_id: str,
        current_stage: int,
    ) -> list[Clue]:
        """Get candidate clues for matching."""
        query = (
            select(Clue)
            .where(Clue.script_id == script_id)
            .where(Clue.status == ClueStatus.ACTIVE)
            .where(Clue.stage <= current_stage)
        )

        result = await self.db.execute(query)
        clues = result.scalars().all()

        # Filter by scene and NPC association
        candidates = []
        for clue in clues:
            # Check scene match (if clue has a scene)
            if clue.scene_id and clue.scene_id != scene_id:
                continue

            # Check NPC association (if clue has NPCs)
            if clue.npc_ids and npc_id not in clue.npc_ids:
                continue

            candidates.append(clue)

        return candidates

    def _match_clue(
        self,
        clue: Clue,
        context: MatchContext,
        strategy: AlgorithmStrategy | None,
    ) -> MatchResult:
        """Match a single clue against the context."""
        result = MatchResult(clue=clue)

        unlock_conditions = clue.unlock_conditions or {}

        # Check state conditions first (prerequisites)
        if not self._check_state_conditions(unlock_conditions, context):
            return result

        # Check keyword conditions
        keyword_score, keyword_matches, keyword_reasons = self._check_keyword_conditions(
            unlock_conditions, context.player_message
        )

        if keyword_score > 0:
            result.score = keyword_score
            result.keyword_matches = keyword_matches
            result.match_reasons = keyword_reasons

        return result

    def _check_state_conditions(
        self,
        unlock_conditions: dict,
        context: MatchContext,
    ) -> bool:
        """Check if state conditions are met."""
        state = unlock_conditions.get("state", {})
        if not state:
            return True

        # Check required clues
        required_clues = state.get("required_clues", [])
        for clue_id in required_clues:
            if clue_id not in context.unlocked_clue_ids:
                return False

        # Check stage range
        min_stage = state.get("min_stage")
        if min_stage and context.current_stage < min_stage:
            return False

        max_stage = state.get("max_stage")
        if max_stage and context.current_stage > max_stage:
            return False

        return True

    def _check_keyword_conditions(
        self,
        unlock_conditions: dict,
        message: str,
    ) -> tuple[float, list[str], list[str]]:
        """
        Check keyword conditions and return score.

        Returns:
            Tuple of (score, matched_keywords, reasons)
        """
        keywords_config = unlock_conditions.get("keywords", {})
        if not keywords_config:
            # No keyword conditions, give a small base score
            return 0.3, [], ["No keyword conditions (default match)"]

        score = 0.0
        matches: list[str] = []
        reasons: list[str] = []

        # Normalize message for matching
        message_words = set(re.findall(r'\w+', message.lower()))

        # Check blacklist first
        blacklist = keywords_config.get("blacklist", [])
        for keyword in blacklist:
            if keyword.lower() in message.lower():
                return 0.0, [], [f"Blacklisted keyword found: {keyword}"]

        # Check must_have (AND condition)
        must_have = keywords_config.get("must_have", [])
        if must_have:
            all_found = True
            for keyword in must_have:
                if keyword.lower() in message.lower():
                    matches.append(keyword)
                else:
                    all_found = False

            if not all_found:
                return 0.0, [], ["Not all required keywords found"]

            score += 0.5
            reasons.append(f"All required keywords found: {must_have}")

        # Check should_have (OR condition)
        should_have = keywords_config.get("should_have", [])
        min_matches = keywords_config.get("min_matches", 1)

        if should_have:
            found_count = 0
            for keyword in should_have:
                if keyword.lower() in message.lower():
                    matches.append(keyword)
                    found_count += 1

            if found_count >= min_matches:
                score += 0.3 * (found_count / len(should_have))
                reasons.append(
                    f"Found {found_count}/{len(should_have)} optional keywords"
                )
            elif not must_have:
                # If no must_have and not enough should_have, no match
                return 0.0, [], [f"Only {found_count} of {min_matches} keywords found"]

        # Ensure score is between 0 and 1
        score = min(1.0, score)

        return score, matches, reasons

    def _get_trigger_threshold(self, strategy: AlgorithmStrategy | None) -> float:
        """Get the trigger threshold from strategy or default."""
        if strategy and strategy.params:
            return strategy.params.get("trigger_threshold", 0.5)
        return 0.5

    def _result_to_schema(self, result: MatchResult) -> MatchedClue:
        """Convert internal result to schema."""
        return MatchedClue(
            clue_id=result.clue.id,
            title_internal=result.clue.title_internal,
            title_player=result.clue.title_player,
            clue_type=result.clue.clue_type.value,
            importance=result.clue.importance.value,
            score=result.score,
            match_reasons=result.match_reasons,
            keyword_matches=result.keyword_matches,
            embedding_similarity=result.embedding_similarity,
            is_triggered=result.is_triggered,
        )
