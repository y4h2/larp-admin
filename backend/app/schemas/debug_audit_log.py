"""Debug audit log schemas for request/response validation."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class DebugAuditLogBase(BaseModel):
    """Base schema for debug audit log."""

    level: Literal["debug", "info", "warn", "error"] = Field(
        default="info", description="Log level"
    )
    source: str = Field(..., min_length=1, max_length=255, description="Source of the log")
    message: str = Field(..., min_length=1, description="Log message")
    context: dict[str, Any] = Field(
        default_factory=dict, description="Additional context data"
    )
    request_id: str | None = Field(None, max_length=255, description="Request ID for tracing")
    user_id: str | None = Field(None, max_length=255, description="User ID if applicable")


class DebugAuditLogCreate(DebugAuditLogBase):
    """Schema for creating a new debug audit log entry."""

    pass


class DebugAuditLogResponse(DebugAuditLogBase):
    """Schema for debug audit log response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
