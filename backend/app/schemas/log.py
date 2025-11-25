"""Log schemas for request/response validation."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DialogueLogResponse(BaseModel):
    """Schema for DialogueLog response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    script_id: str
    npc_id: str
    player_message: str
    npc_response: str | None = None
    context: dict[str, Any]
    matched_clues: dict[str, Any] | list[dict[str, Any]]
    triggered_clues: list[str]
    created_at: datetime


class DialogueLogFilter(BaseModel):
    """Schema for filtering dialogue logs."""

    script_id: str | None = Field(None, description="Filter by script ID")
    npc_id: str | None = Field(None, description="Filter by NPC ID")
    start_date: datetime | None = Field(None, description="Filter from date")
    end_date: datetime | None = Field(None, description="Filter to date")
