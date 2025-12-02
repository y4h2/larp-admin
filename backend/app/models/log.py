"""Dialogue log model definition."""

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.utils import generate_dialogue_log_id


class DialogueLog(Base):
    """
    DialogueLog model for storing conversation logs and matching results.

    This table records player messages, the matching strategy used,
    and which clues were matched and triggered.
    """

    __tablename__ = "dialogue_logs"

    id: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
        default=generate_dialogue_log_id,
    )
    session_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Session identifier for grouping related dialogue logs",
    )
    username: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        comment="Username of who initiated the dialogue",
    )
    script_id: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("scripts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    npc_id: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("npcs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    player_message: Mapped[str] = mapped_column(Text, nullable=False)
    npc_response: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="NPC response to the player message",
    )
    context: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Current state and unlocked clues",
    )
    matched_clues: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="All matched clues with scores",
    )
    triggered_clues: Mapped[list[str]] = mapped_column(
        ARRAY(String(20)),
        default=list,
        nullable=False,
        comment="Final triggered clue IDs",
    )
    debug_info: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Algorithm debug information (threshold, candidates, excluded, etc.)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<DialogueLog(id={self.id}, script={self.script_id}, created={self.created_at})>"
