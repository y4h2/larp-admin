"""Reference data schemas for aggregated API response."""

from pydantic import BaseModel, Field

from app.schemas.llm_config import LLMConfigResponse
from app.schemas.npc import NPCResponse
from app.schemas.prompt_template import TemplateResponse
from app.schemas.script import ScriptResponse


class ReferenceDataResponse(BaseModel):
    """Aggregated reference data response for frontend optimization."""

    scripts: list[ScriptResponse] = Field(default_factory=list, description="All scripts")
    npcs: list[NPCResponse] = Field(default_factory=list, description="All NPCs")
    templates: list[TemplateResponse] = Field(default_factory=list, description="All prompt templates")
    llm_configs: list[LLMConfigResponse] = Field(default_factory=list, description="All LLM configurations")
