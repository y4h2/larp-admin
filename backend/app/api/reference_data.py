"""Reference data API endpoint for aggregated data fetching."""

import logging

from fastapi import APIRouter
from sqlalchemy import select

from app.database import DBSession
from app.models.llm_config import LLMConfig
from app.models.npc import NPC
from app.models.prompt_template import PromptTemplate
from app.models.script import Script
from app.schemas.llm_config import LLMConfigResponse
from app.schemas.npc import NPCResponse
from app.schemas.prompt_template import TemplateResponse
from app.schemas.reference_data import ReferenceDataResponse
from app.schemas.script import ScriptResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=ReferenceDataResponse)
async def get_reference_data(db: DBSession) -> ReferenceDataResponse:
    """
    Get aggregated reference data in a single request.

    This endpoint returns commonly needed reference data (scripts, npcs, templates, llm_configs)
    to reduce the number of API calls from the frontend.

    Note: SQLAlchemy async session doesn't support concurrent operations,
    so queries are executed sequentially. The benefit comes from reducing
    HTTP round-trips, not database parallelism.
    """
    # Fetch scripts
    scripts_result = await db.execute(
        select(Script)
        .where(Script.deleted_at.is_(None))
        .order_by(Script.updated_at.desc())
    )
    scripts = [ScriptResponse.model_validate(s) for s in scripts_result.scalars().all()]

    # Fetch NPCs
    npcs_result = await db.execute(
        select(NPC).order_by(NPC.updated_at.desc())
    )
    npcs = [NPCResponse.model_validate(n) for n in npcs_result.scalars().all()]

    # Fetch templates
    templates_result = await db.execute(
        select(PromptTemplate)
        .where(PromptTemplate.deleted_at.is_(None))
        .order_by(PromptTemplate.updated_at.desc())
    )
    templates = [TemplateResponse.model_validate(t) for t in templates_result.scalars().all()]

    # Fetch LLM configs
    llm_configs_result = await db.execute(
        select(LLMConfig)
        .where(LLMConfig.deleted_at.is_(None))
        .order_by(LLMConfig.updated_at.desc())
    )
    llm_configs = [LLMConfigResponse.from_model(c) for c in llm_configs_result.scalars().all()]

    logger.debug(
        f"Reference data fetched: {len(scripts)} scripts, {len(npcs)} NPCs, "
        f"{len(templates)} templates, {len(llm_configs)} LLM configs"
    )

    return ReferenceDataResponse(
        scripts=scripts,
        npcs=npcs,
        templates=templates,
        llm_configs=llm_configs,
    )
