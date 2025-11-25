"""LLM Configuration model for embedding and chat models."""

import enum
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LLMConfigType(str, enum.Enum):
    """Type of LLM configuration."""

    EMBEDDING = "embedding"
    CHAT = "chat"


class LLMConfig(Base):
    """
    LLM Configuration model for storing embedding and chat model settings.

    Common fields:
    - model: Model name (e.g., "text-embedding-ada-002", "gpt-4")
    - base_url: API base URL
    - api_key: API key

    Type-specific options (stored in JSON):
    - For embedding: similarity_threshold, dimensions
    - For chat: temperature, max_tokens, top_p, etc.
    """

    __tablename__ = "llm_configs"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Display name for this configuration",
    )
    type: Mapped[LLMConfigType] = mapped_column(
        Enum(
            LLMConfigType,
            name="llm_config_type",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
        comment="Configuration type: embedding or chat",
    )
    model: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Model name (e.g., text-embedding-ada-002, gpt-4)",
    )
    base_url: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        comment="API base URL",
    )
    api_key: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="API key (should be encrypted in production)",
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
        comment="Whether this is the default config for its type",
    )
    options: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Type-specific options: embedding (similarity_threshold, dimensions) or chat (temperature, max_tokens, etc.)",
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
        return f"<LLMConfig(id={self.id}, name={self.name}, type={self.type})>"
