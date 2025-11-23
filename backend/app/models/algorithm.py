"""Algorithm implementation and strategy model definitions."""

import enum
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AlgorithmType(str, enum.Enum):
    """Type of matching algorithm."""

    KEYWORD = "keyword"
    EMBEDDING = "embedding"
    HYBRID = "hybrid"
    LLM_RERANK = "llm_rerank"


class AlgorithmImplStatus(str, enum.Enum):
    """Status of an algorithm implementation."""

    AVAILABLE = "available"
    DEPRECATED = "deprecated"


class StrategyScopeType(str, enum.Enum):
    """Scope type for algorithm strategy."""

    GLOBAL = "global"
    SCRIPT = "script"
    SCENE = "scene"
    NPC = "npc"


class StrategyStatus(str, enum.Enum):
    """Status of an algorithm strategy."""

    DRAFT = "draft"
    PUBLISHED = "published"
    DEPRECATED = "deprecated"


class AlgorithmImplementation(Base):
    """
    AlgorithmImplementation model representing a backend code implementation.

    This is a read-only table maintained by engineers that defines available
    matching algorithms.
    """

    __tablename__ = "algorithm_implementations"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        comment="Algorithm ID like 'keyword_v1', 'embedding_v2'",
    )
    type: Mapped[AlgorithmType] = mapped_column(
        Enum(AlgorithmType, name="algorithm_type", create_type=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    doc_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[AlgorithmImplStatus] = mapped_column(
        Enum(AlgorithmImplStatus, name="algorithm_impl_status", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=AlgorithmImplStatus.AVAILABLE,
        nullable=False,
    )
    param_schema: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="JSON Schema for parameter validation",
    )

    # Relationships
    strategies: Mapped[list["AlgorithmStrategy"]] = relationship(
        "AlgorithmStrategy",
        back_populates="implementation",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<AlgorithmImplementation(id={self.id}, type={self.type})>"


class AlgorithmStrategy(Base):
    """
    AlgorithmStrategy model representing a configurable strategy using an implementation.

    Strategies can be configured at different scopes (global, script, scene, NPC)
    and contain parameter values for the underlying algorithm.
    """

    __tablename__ = "algorithm_strategies"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    impl_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("algorithm_implementations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    scope_type: Mapped[StrategyScopeType] = mapped_column(
        Enum(StrategyScopeType, name="strategy_scope_type", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=StrategyScopeType.GLOBAL,
        nullable=False,
    )
    scope_target_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        nullable=True,
        comment="Target ID for script/scene/npc scope",
    )
    params: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Algorithm parameters",
    )
    status: Mapped[StrategyStatus] = mapped_column(
        Enum(StrategyStatus, name="strategy_status", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=StrategyStatus.DRAFT,
        nullable=False,
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
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
    implementation: Mapped["AlgorithmImplementation"] = relationship(
        "AlgorithmImplementation",
        back_populates="strategies",
    )

    def __repr__(self) -> str:
        return f"<AlgorithmStrategy(id={self.id}, name={self.name}, impl={self.impl_id})>"
