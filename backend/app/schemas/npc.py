"""NPC schemas for request/response validation based on data/sample/clue.py."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeScopeSchema(BaseModel):
    """
    Schema for NPC knowledge scope.

    Based on NPCKnowledgeScope in data/sample/clue.py:
    - knows: list[str]
    - does_not_know: list[str]
    - world_model_limits: list[str]
    """

    knows: list[str] = Field(default_factory=list, description="Things the NPC knows")
    does_not_know: list[str] = Field(default_factory=list, description="Things the NPC does not know")
    world_model_limits: list[str] = Field(default_factory=list, description="Limits of the NPC's world model")


class NPCBase(BaseModel):
    """
    Base schema for NPC with common fields.

    Based on the NPC dataclass in data/sample/clue.py:
    - name: str
    - age: int
    - background: str
    - personality: str
    - knowledge_scope: NPCKnowledgeScope
    """

    name: str = Field(..., min_length=1, max_length=255, description="NPC name")
    age: int | None = Field(None, ge=0, le=200, description="NPC age")
    background: str | None = Field(None, description="NPC background story")
    personality: str | None = Field(None, description="NPC personality traits")
    knowledge_scope: KnowledgeScopeSchema = Field(
        default_factory=KnowledgeScopeSchema, description="NPC knowledge scope"
    )


class NPCCreate(NPCBase):
    """Schema for creating a new NPC."""

    script_id: str = Field(..., description="Script ID this NPC belongs to")


class NPCUpdate(BaseModel):
    """Schema for updating an existing NPC."""

    name: str | None = Field(None, min_length=1, max_length=255)
    age: int | None = Field(None, ge=0, le=200)
    background: str | None = None
    personality: str | None = None
    knowledge_scope: KnowledgeScopeSchema | None = None


class NPCResponse(NPCBase):
    """Schema for NPC response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    script_id: str
    created_at: datetime
    updated_at: datetime
