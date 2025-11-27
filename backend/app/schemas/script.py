"""Script schemas - export/import only.

CRUD schemas removed - now handled via Supabase PostgREST.
Only export/import and response schemas are kept here.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ScriptResponse(BaseModel):
    """Schema for Script response (used by copy/import endpoints)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    summary: str | None = None
    background: str | None = None
    difficulty: str
    truth: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


# Export/Import schemas
class NPCExportData(BaseModel):
    """NPC data for export (without script_id, timestamps)."""

    name: str
    age: int | None = None
    background: str | None = None
    personality: str | None = None
    knowledge_scope: dict[str, Any] = Field(default_factory=dict)
    # Use export_id to track relationships within the export file
    export_id: str = Field(..., description="Temporary ID for linking clues")


class ClueExportData(BaseModel):
    """Clue data for export (without script_id, timestamps)."""

    name: str
    type: Literal["text", "image"] = "text"
    detail: str
    detail_for_npc: str
    trigger_keywords: list[str] = Field(default_factory=list)
    trigger_semantic_summary: str = ""
    # Use export_id references
    export_id: str = Field(..., description="Temporary ID for this clue")
    npc_export_id: str = Field(..., description="Reference to NPC export_id")
    prereq_clue_export_ids: list[str] = Field(
        default_factory=list, description="References to prerequisite clue export_ids"
    )


class ScriptExportData(BaseModel):
    """Complete script export bundle."""

    version: str = Field(default="1.0", description="Export format version")
    title: str
    summary: str | None = None
    background: str | None = None
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    truth: dict[str, Any] = Field(default_factory=dict)
    npcs: list[NPCExportData] = Field(default_factory=list)
    clues: list[ClueExportData] = Field(default_factory=list)


class ScriptImportRequest(BaseModel):
    """Request schema for importing a script."""

    data: ScriptExportData
    new_title: str | None = Field(None, description="Override title for imported script")
