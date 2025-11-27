"""Clue (线索) model definition based on data/sample/clue.py."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils import generate_clue_id

if TYPE_CHECKING:
    from app.models.npc import NPC
    from app.models.script import Script


class ClueType(str, enum.Enum):
    """Type of clue content."""

    TEXT = "text"
    IMAGE = "image"


class Clue(Base):
    """
    Clue model representing a piece of information players can obtain.

    Based on the Clue dataclass in data/sample/clue.py:
    - id: ClueId
    - npc_id: str
    - name: str
    - type: ClueType (text, image)
    - detail: str (线索本身)
    - detail_for_npc: str (指导 NPC 回答这条线索时需要说的话)
    - trigger_keywords: list[str] (for vector match)
    - trigger_semantic_summary: str (for vector match)
    - prereq_clues: list[ClueId] (前置线索)
    """

    __tablename__ = "clues"

    id: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
        default=generate_clue_id,
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
        comment="The NPC who knows this clue",
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Clue name/title",
    )
    type: Mapped[ClueType] = mapped_column(
        Enum(ClueType, name="clue_type", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=ClueType.TEXT,
        nullable=False,
        comment="Content type: text or image",
    )
    detail: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="The clue content itself (线索本身)",
    )
    detail_for_npc: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Guidance for NPC on how to reveal this clue (指导 NPC 回答这条线索时需要说的话)",
    )
    trigger_keywords: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        default=list,
        nullable=False,
        comment="Keywords for vector match",
    )
    trigger_semantic_summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        comment="Semantic summary for vector match",
    )
    prereq_clue_ids: Mapped[list[str]] = mapped_column(
        ARRAY(String(20)),
        default=list,
        nullable=False,
        comment="Prerequisite clue IDs (前置线索)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    script: Mapped["Script"] = relationship("Script", back_populates="clues")
    npc: Mapped["NPC"] = relationship("NPC", back_populates="clues")

    def __repr__(self) -> str:
        return f"<Clue(id={self.id}, name={self.name}, type={self.type})>"
