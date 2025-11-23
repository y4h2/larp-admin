"""Clue (线索) and ClueRelation model definitions."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.scene import Scene
    from app.models.script import Script


class ContentType(str, enum.Enum):
    """Type of clue content."""

    TEXT = "text"
    IMAGE = "image"
    STRUCTURED = "structured"


class ClueType(str, enum.Enum):
    """Type of clue."""

    EVIDENCE = "evidence"
    TESTIMONY = "testimony"
    WORLD_INFO = "world_info"
    DECOY = "decoy"


class ClueImportance(str, enum.Enum):
    """Importance level of a clue."""

    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    EASTER_EGG = "easter_egg"


class ClueStatus(str, enum.Enum):
    """Status of a clue."""

    DRAFT = "draft"
    ACTIVE = "active"
    DISABLED = "disabled"


class ClueRelationType(str, enum.Enum):
    """Type of clue relation."""

    REQUIRED = "required"
    OPTIONAL = "optional"


class Clue(Base):
    """
    Clue model representing a piece of information players can obtain.

    Clues have unlock conditions, trigger effects, and relationships with other clues.
    """

    __tablename__ = "clues"

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
    scene_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("scenes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title_internal: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Internal title for designers",
    )
    title_player: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Title shown to players",
    )
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[ContentType] = mapped_column(
        Enum(ContentType, name="content_type", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=ContentType.TEXT,
        nullable=False,
    )
    content_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Additional content data (images, structured content)",
    )
    clue_type: Mapped[ClueType] = mapped_column(
        Enum(ClueType, name="clue_type", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=ClueType.EVIDENCE,
        nullable=False,
    )
    importance: Mapped[ClueImportance] = mapped_column(
        Enum(ClueImportance, name="clue_importance", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=ClueImportance.MINOR,
        nullable=False,
    )
    stage: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
        comment="Story stage this clue belongs to",
    )
    npc_ids: Mapped[list[str]] = mapped_column(
        ARRAY(UUID(as_uuid=False)),
        default=list,
        nullable=False,
        comment="Related NPC IDs",
    )
    status: Mapped[ClueStatus] = mapped_column(
        Enum(ClueStatus, name="clue_status", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=ClueStatus.DRAFT,
        nullable=False,
    )
    unlock_conditions: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Conditions to unlock this clue",
    )
    effects: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Effects when clue is triggered",
    )
    one_time: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether clue can only be triggered once",
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
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Relationships
    script: Mapped["Script"] = relationship("Script", back_populates="clues")
    scene: Mapped["Scene | None"] = relationship("Scene", back_populates="clues")

    # Self-referential relationships through ClueRelation
    prerequisites: Mapped[list["ClueRelation"]] = relationship(
        "ClueRelation",
        foreign_keys="ClueRelation.dependent_clue_id",
        back_populates="dependent_clue",
        cascade="all, delete-orphan",
    )
    dependents: Mapped[list["ClueRelation"]] = relationship(
        "ClueRelation",
        foreign_keys="ClueRelation.prerequisite_clue_id",
        back_populates="prerequisite_clue",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Clue(id={self.id}, title={self.title_internal}, type={self.clue_type})>"


class ClueRelation(Base):
    """
    ClueRelation model representing prerequisite relationships between clues.

    This defines the dependency graph for clue unlocking.
    """

    __tablename__ = "clue_relations"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    prerequisite_clue_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("clues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dependent_clue_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("clues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relation_type: Mapped[ClueRelationType] = mapped_column(
        Enum(ClueRelationType, name="clue_relation_type", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=ClueRelationType.REQUIRED,
        nullable=False,
    )

    # Relationships
    prerequisite_clue: Mapped["Clue"] = relationship(
        "Clue",
        foreign_keys=[prerequisite_clue_id],
        back_populates="dependents",
    )
    dependent_clue: Mapped["Clue"] = relationship(
        "Clue",
        foreign_keys=[dependent_clue_id],
        back_populates="prerequisites",
    )

    def __repr__(self) -> str:
        return f"<ClueRelation(prerequisite={self.prerequisite_clue_id}, dependent={self.dependent_clue_id})>"
