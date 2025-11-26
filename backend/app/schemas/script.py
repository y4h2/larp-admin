"""Script schemas for request/response validation based on data/sample/clue.py."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class TruthSchema(BaseModel):
    """
    Schema for the truth of a murder mystery case.

    Based on the Truth dataclass in data/sample/clue.py:
    - murderer: NPCId
    - weapon: str
    - motive: str
    - crime_method: str
    """

    murderer: str | None = Field(None, description="The murderer NPC ID or name")
    weapon: str | None = Field(None, description="The murder weapon")
    motive: str | None = Field(None, description="The motive for the crime")
    crime_method: str | None = Field(None, description="How the crime was committed")


class ScriptBase(BaseModel):
    """
    Base schema for Script with common fields.

    Based on the Script dataclass in data/sample/clue.py:
    - title: str
    - summary: str
    - background: str
    - difficulty: Difficulty
    - truth: Truth
    """

    title: str = Field(..., min_length=1, max_length=255, description="Script title")
    summary: str | None = Field(None, description="Brief summary of the script story")
    background: str | None = Field(None, description="Background setting and context for the story")
    difficulty: Literal["easy", "medium", "hard"] = Field(
        default="medium", description="Script difficulty"
    )
    truth: dict[str, Any] = Field(
        default_factory=dict, description="The truth of the case: murderer, weapon, motive, crime_method"
    )


class ScriptCreate(ScriptBase):
    """Schema for creating a new Script."""

    pass


class ScriptUpdate(BaseModel):
    """Schema for updating an existing Script."""

    title: str | None = Field(None, min_length=1, max_length=255)
    summary: str | None = None
    background: str | None = None
    difficulty: Literal["easy", "medium", "hard"] | None = None
    truth: dict[str, Any] | None = None


class ScriptResponse(ScriptBase):
    """Schema for Script response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class ScriptListResponse(ScriptResponse):
    """Schema for Script in list response with additional counts."""

    npc_count: int = Field(default=0, description="Number of NPCs")
    clue_count: int = Field(default=0, description="Number of clues")


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
