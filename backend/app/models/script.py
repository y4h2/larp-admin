"""Script (剧本) model definition based on data/sample/clue.py."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils import generate_script_id

if TYPE_CHECKING:
    from app.models.clue import Clue
    from app.models.npc import NPC


class ScriptDifficulty(str, enum.Enum):
    """Difficulty level of a script."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class Script(Base):
    """
    Script model representing a complete murder mystery case.

    Based on the Script dataclass in data/sample/clue.py:
    - id: ScriptId
    - title: str
    - summary: str
    - background: str
    - difficulty: Difficulty
    - truth: Truth (murderer, weapon, motive, crime_method)
    """

    __tablename__ = "scripts"

    id: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
        default=generate_script_id,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Script title",
    )
    summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Brief summary of the script story",
    )
    background: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Background setting and context for the story",
    )
    difficulty: Mapped[ScriptDifficulty] = mapped_column(
        Enum(ScriptDifficulty, name="script_difficulty", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=ScriptDifficulty.MEDIUM,
        nullable=False,
    )
    truth: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="The truth of the case: murderer, weapon, motive, crime_method",
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
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # Relationships
    npcs: Mapped[list["NPC"]] = relationship(
        "NPC",
        back_populates="script",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    clues: Mapped[list["Clue"]] = relationship(
        "Clue",
        back_populates="script",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Script(id={self.id}, title={self.title})>"
