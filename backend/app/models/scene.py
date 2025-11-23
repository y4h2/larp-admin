"""Scene (场景) model definition."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.clue import Clue
    from app.models.script import Script


class SceneType(str, enum.Enum):
    """Type of scene."""

    INVESTIGATION = "investigation"
    INTERROGATION = "interrogation"
    FREE_DIALOGUE = "free_dialogue"


class Scene(Base):
    """
    Scene model representing a chapter/location/time period in a script.

    Scenes organize the narrative structure of a murder mystery.
    """

    __tablename__ = "scenes"

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
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    scene_type: Mapped[SceneType] = mapped_column(
        Enum(SceneType, name="scene_type", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=SceneType.INVESTIGATION,
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
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
    script: Mapped["Script"] = relationship("Script", back_populates="scenes")
    clues: Mapped[list["Clue"]] = relationship(
        "Clue",
        back_populates="scene",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Scene(id={self.id}, name={self.name}, script_id={self.script_id})>"
