"""Script (剧本) model definition."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.clue import Clue
    from app.models.npc import NPC
    from app.models.scene import Scene


class ScriptStatus(str, enum.Enum):
    """Status of a script."""

    DRAFT = "draft"
    TEST = "test"
    ONLINE = "online"


class ScriptDifficulty(str, enum.Enum):
    """Difficulty level of a script."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class Script(Base):
    """
    Script model representing a complete murder mystery case.

    A script is the top-level container for scenes, NPCs, and clues.
    """

    __tablename__ = "scripts"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ScriptStatus] = mapped_column(
        Enum(ScriptStatus, name="script_status", create_type=False),
        default=ScriptStatus.DRAFT,
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    player_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    expected_duration: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="Expected duration in minutes"
    )
    difficulty: Mapped[ScriptDifficulty] = mapped_column(
        Enum(ScriptDifficulty, name="script_difficulty", create_type=False),
        default=ScriptDifficulty.MEDIUM,
        nullable=False,
    )
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
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
    scenes: Mapped[list["Scene"]] = relationship(
        "Scene",
        back_populates="script",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
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
        return f"<Script(id={self.id}, name={self.name}, status={self.status})>"
