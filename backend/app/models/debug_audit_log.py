"""Debug audit log model definition."""

import enum
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LogLevel(str, enum.Enum):
    """Log level for debug audit logs."""

    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


class DebugAuditLog(Base):
    """
    Debug audit log model for storing debug and audit information.

    This table records system events, errors, and debug information
    for troubleshooting and auditing purposes.
    """

    __tablename__ = "debug_audit_logs"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    level: Mapped[LogLevel] = mapped_column(
        Enum(LogLevel, name="log_level", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=LogLevel.INFO,
        nullable=False,
        index=True,
        comment="Log level: debug, info, warn, error",
    )
    source: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Source of the log (e.g., module name, endpoint)",
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Log message",
    )
    context: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Additional context data (request params, stack trace, etc.)",
    )
    request_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        comment="Request ID for tracing",
    )
    user_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        comment="User ID if applicable",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<DebugAuditLog(id={self.id}, level={self.level}, source={self.source})>"
