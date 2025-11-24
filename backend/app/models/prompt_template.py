"""PromptTemplate model definition."""

import enum
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TemplateType(str, enum.Enum):
    """Type of prompt template."""

    SYSTEM = "system"
    NPC_DIALOG = "npc_dialog"
    CLUE_EXPLAIN = "clue_explain"


class TemplateScopeType(str, enum.Enum):
    """Scope type for prompt template."""

    GLOBAL = "global"
    SCRIPT = "script"
    NPC = "npc"


class TemplateStatus(str, enum.Enum):
    """Status of a prompt template."""

    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class PromptTemplate(Base):
    """
    PromptTemplate model for managing prompt templates used in dialogue simulation.

    Templates support variable placeholders like {npc.name}, {player_input}, etc.
    """

    __tablename__ = "prompt_templates"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[TemplateType] = mapped_column(
        Enum(TemplateType, name="template_type", create_type=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    scope_type: Mapped[TemplateScopeType] = mapped_column(
        Enum(TemplateScopeType, name="template_scope_type", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=TemplateScopeType.GLOBAL,
        nullable=False,
    )
    scope_target_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        nullable=True,
        comment="Target ID for script/npc scope",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Template content with {var} placeholders",
    )
    variables_meta: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Metadata about used variables for validation",
    )
    status: Mapped[TemplateStatus] = mapped_column(
        Enum(TemplateStatus, name="template_status", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=TemplateStatus.DRAFT,
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

    def __repr__(self) -> str:
        return f"<PromptTemplate(id={self.id}, name={self.name}, type={self.type})>"
