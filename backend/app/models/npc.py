"""NPC model definition."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.script import Script


class NPCRoleType(str, enum.Enum):
    """Role type of an NPC."""

    SUSPECT = "suspect"
    WITNESS = "witness"
    OTHER = "other"


class NPCStatus(str, enum.Enum):
    """Status of an NPC."""

    ACTIVE = "active"
    ARCHIVED = "archived"


class NPC(Base):
    """
    NPC model representing a non-player character in a script.

    NPCs can be suspects, witnesses, or other characters that players interact with.
    """

    __tablename__ = "npcs"

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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    job: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role_type: Mapped[NPCRoleType] = mapped_column(
        Enum(NPCRoleType, name="npc_role_type", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=NPCRoleType.OTHER,
        nullable=False,
    )
    personality: Mapped[str | None] = mapped_column(Text, nullable=True)
    speech_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    background_story: Mapped[str | None] = mapped_column(Text, nullable=True)
    relations: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Relationships with other NPCs",
    )
    knowledge_scope: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="NPC knowledge scope: knows, does_not_know, world_model_limits",
    )
    system_prompt_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_prompt_vars: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )
    status: Mapped[NPCStatus] = mapped_column(
        Enum(NPCStatus, name="npc_status", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=NPCStatus.ACTIVE,
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

    # Relationships
    script: Mapped["Script"] = relationship("Script", back_populates="npcs")

    def __repr__(self) -> str:
        return f"<NPC(id={self.id}, name={self.name}, role_type={self.role_type})>"
