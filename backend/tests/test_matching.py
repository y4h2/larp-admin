"""Tests for the matching service."""

import pytest

from app.services.matching import MatchingService


class TestKeywordMatching:
    """Tests for keyword matching logic."""

    def test_check_keyword_conditions_must_have(self) -> None:
        """Test must_have keyword matching."""
        service = MatchingService.__new__(MatchingService)

        conditions = {
            "keywords": {
                "must_have": ["knife", "blood"],
                "should_have": [],
                "blacklist": [],
                "min_matches": 1,
            }
        }

        # All keywords present
        score, matches, reasons = service._check_keyword_conditions(
            conditions, "I found a knife with blood on it"
        )
        assert score > 0
        assert "knife" in matches
        assert "blood" in matches

        # Missing keyword
        score, matches, reasons = service._check_keyword_conditions(
            conditions, "I found a knife"
        )
        assert score == 0

    def test_check_keyword_conditions_should_have(self) -> None:
        """Test should_have keyword matching."""
        service = MatchingService.__new__(MatchingService)

        conditions = {
            "keywords": {
                "must_have": [],
                "should_have": ["weapon", "knife", "gun"],
                "blacklist": [],
                "min_matches": 1,
            }
        }

        # At least one keyword present
        score, matches, reasons = service._check_keyword_conditions(
            conditions, "I see a knife on the table"
        )
        assert score > 0
        assert "knife" in matches

        # No keywords present
        score, matches, reasons = service._check_keyword_conditions(
            conditions, "I see a book on the table"
        )
        assert score == 0

    def test_check_keyword_conditions_blacklist(self) -> None:
        """Test blacklist keyword blocking."""
        service = MatchingService.__new__(MatchingService)

        conditions = {
            "keywords": {
                "must_have": ["search"],
                "should_have": [],
                "blacklist": ["help"],
                "min_matches": 1,
            }
        }

        # Blacklisted keyword present
        score, matches, reasons = service._check_keyword_conditions(
            conditions, "help me search the room"
        )
        assert score == 0

        # No blacklisted keyword
        score, matches, reasons = service._check_keyword_conditions(
            conditions, "I want to search the room"
        )
        assert score > 0

    def test_check_keyword_conditions_combined(self) -> None:
        """Test combined must_have and should_have."""
        service = MatchingService.__new__(MatchingService)

        conditions = {
            "keywords": {
                "must_have": ["investigate"],
                "should_have": ["body", "crime", "scene"],
                "blacklist": [],
                "min_matches": 1,
            }
        }

        # Both must_have and should_have matched
        score, matches, reasons = service._check_keyword_conditions(
            conditions, "I want to investigate the body"
        )
        assert score > 0
        assert "investigate" in matches
        assert "body" in matches

        # Only must_have matched
        score, matches, reasons = service._check_keyword_conditions(
            conditions, "I want to investigate"
        )
        assert score > 0  # Still matches because must_have is satisfied

    def test_no_keyword_conditions(self) -> None:
        """Test behavior when no keyword conditions are set."""
        service = MatchingService.__new__(MatchingService)

        # No conditions - should give default score
        score, matches, reasons = service._check_keyword_conditions(
            {}, "any message here"
        )
        assert score == 0.3  # Default match score


class TestStateConditions:
    """Tests for state condition checking."""

    def test_required_clues_met(self) -> None:
        """Test when required clues are unlocked."""
        from app.services.matching import MatchContext

        service = MatchingService.__new__(MatchingService)

        conditions = {
            "state": {
                "required_clues": ["clue-1", "clue-2"],
                "min_stage": None,
                "max_stage": None,
            }
        }

        context = MatchContext(
            player_message="test",
            unlocked_clue_ids={"clue-1", "clue-2", "clue-3"},
            current_stage=1,
            scene_id="scene-1",
            npc_id="npc-1",
        )

        result = service._check_state_conditions(conditions, context)
        assert result is True

    def test_required_clues_not_met(self) -> None:
        """Test when required clues are not unlocked."""
        from app.services.matching import MatchContext

        service = MatchingService.__new__(MatchingService)

        conditions = {
            "state": {
                "required_clues": ["clue-1", "clue-2"],
                "min_stage": None,
                "max_stage": None,
            }
        }

        context = MatchContext(
            player_message="test",
            unlocked_clue_ids={"clue-1"},  # Missing clue-2
            current_stage=1,
            scene_id="scene-1",
            npc_id="npc-1",
        )

        result = service._check_state_conditions(conditions, context)
        assert result is False

    def test_stage_conditions(self) -> None:
        """Test stage-based conditions."""
        from app.services.matching import MatchContext

        service = MatchingService.__new__(MatchingService)

        conditions = {
            "state": {
                "required_clues": [],
                "min_stage": 2,
                "max_stage": 4,
            }
        }

        # Stage too low
        context_low = MatchContext(
            player_message="test",
            unlocked_clue_ids=set(),
            current_stage=1,
            scene_id="scene-1",
            npc_id="npc-1",
        )
        assert service._check_state_conditions(conditions, context_low) is False

        # Stage in range
        context_ok = MatchContext(
            player_message="test",
            unlocked_clue_ids=set(),
            current_stage=3,
            scene_id="scene-1",
            npc_id="npc-1",
        )
        assert service._check_state_conditions(conditions, context_ok) is True

        # Stage too high
        context_high = MatchContext(
            player_message="test",
            unlocked_clue_ids=set(),
            current_stage=5,
            scene_id="scene-1",
            npc_id="npc-1",
        )
        assert service._check_state_conditions(conditions, context_high) is False
