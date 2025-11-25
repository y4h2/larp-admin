"""Dialogue log model definition."""

from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DialogueLog(Base):
    """
    DialogueLog model for storing conversation logs and matching results.

    This table records player messages, the matching strategy used,
    and which clues were matched and triggered.
    """

    __tablename__ = "dialogue_logs"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    script_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("scripts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    npc_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("npcs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    player_message: Mapped[str] = mapped_column(Text, nullable=False)
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
        ARRAY(UUID(as_uuid=False)),
        default=list,
        nullable=False,
        comment="Final triggered clue IDs",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<DialogueLog(id={self.id}, script={self.script_id}, created={self.created_at})>"
