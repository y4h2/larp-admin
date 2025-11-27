"""NPC model definition based on data/sample/clue.py."""

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils import generate_npc_id

if TYPE_CHECKING:
    from app.models.clue import Clue
    from app.models.script import Script


class NPC(Base):
    """
    NPC model representing a non-player character in a script.

    Based on the NPC dataclass in data/sample/clue.py:
    - id: NPCId
    - name: str
    - age: int
    - background: str
    - personality: str
    - knowledge_scope: NPCKnowledgeScope (knows, does_not_know, world_model_limits)
    """

    __tablename__ = "npcs"

    id: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
        default=generate_npc_id,
    )
    script_id: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("scripts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    background: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="NPC background story",
    )
    personality: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="NPC personality traits",
    )
    knowledge_scope: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="NPC knowledge scope: knows, does_not_know, world_model_limits",
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
    script: Mapped["Script"] = relationship("Script", back_populates="npcs")
    clues: Mapped[list["Clue"]] = relationship(
        "Clue",
        back_populates="npc",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<NPC(id={self.id}, name={self.name})>"
