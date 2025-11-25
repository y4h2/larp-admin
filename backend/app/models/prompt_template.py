"""PromptTemplate model definition.

Supports template syntax like '{clue.name}:{clue.detail}' with jsonpath-style
nested field access for clue, npc, and script objects.
"""

import enum
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TemplateType(str, enum.Enum):
    """Type/purpose of prompt template."""

    # For building embedding content from clue fields
    CLUE_EMBEDDING = "clue_embedding"
    # System prompt for NPC dialogue
    NPC_SYSTEM_PROMPT = "npc_system_prompt"
    # How NPC should explain/reveal a clue
    CLUE_REVEAL = "clue_reveal"
    # Custom template for other purposes
    CUSTOM = "custom"


class PromptTemplate(Base):
    """
    PromptTemplate model for managing prompt templates.

    Templates support variable placeholders with jsonpath-style nested access:
    - {clue.name}, {clue.detail}, {clue.trigger_keywords}
    - {npc.name}, {npc.personality}, {npc.knowledge_scope.knows}
    - {script.title}, {script.truth.murderer}
    - {player_input}, {now}

    Example template:
        '{clue.name}:{clue.detail}'
        'You are {npc.name}. Your personality: {npc.personality}'
    """

    __tablename__ = "prompt_templates"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Template display name",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Template description",
    )
    type: Mapped[TemplateType] = mapped_column(
        Enum(
            TemplateType,
            name="template_type",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
        comment="Template type/purpose",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Template content with {var.path} placeholders",
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
        comment="Whether this is the default template for its type",
    )
    variables: Mapped[list[str]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
        comment="Auto-extracted variable names from content",
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

    def __repr__(self) -> str:
        return f"<PromptTemplate(id={self.id}, name={self.name}, type={self.type})>"
