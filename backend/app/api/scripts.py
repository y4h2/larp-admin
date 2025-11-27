"""Script API endpoints - complex operations only.

CRUD operations are now handled via Supabase PostgREST.
Only copy, export, and import endpoints are kept here.
"""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import DBSession
from app.models.script import Script, ScriptDifficulty
from app.schemas.script import (
    ClueExportData,
    NPCExportData,
    ScriptExportData,
    ScriptImportRequest,
    ScriptResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/{script_id}/copy", response_model=ScriptResponse, status_code=status.HTTP_201_CREATED)
async def copy_script(
    db: DBSession,
    script_id: str,
    new_title: str | None = Query(default=None, description="Title for the copied script"),
) -> ScriptResponse:
    """Create a copy of an existing script."""
    result = await db.execute(
        select(Script)
        .where(Script.id == script_id)
        .where(Script.deleted_at.is_(None))
        .options(
            selectinload(Script.npcs),
            selectinload(Script.clues),
        )
    )
    source = result.scalars().first()

    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script with id {script_id} not found",
        )

    # Create copy
    new_script = Script(
        id=str(uuid4()),
        title=new_title or f"{source.title} (Copy)",
        summary=source.summary,
        background=source.background,
        difficulty=source.difficulty,
        truth=source.truth,
    )

    db.add(new_script)
    await db.flush()
    await db.refresh(new_script)

    logger.info(f"Copied script {script_id} to {new_script.id}")
    return ScriptResponse.model_validate(new_script)


@router.get("/{script_id}/export", response_model=ScriptExportData)
async def export_script(
    db: DBSession,
    script_id: str,
) -> ScriptExportData:
    """Export a script with all its NPCs and clues as a JSON bundle."""
    result = await db.execute(
        select(Script)
        .where(Script.id == script_id)
        .where(Script.deleted_at.is_(None))
        .options(
            selectinload(Script.npcs),
            selectinload(Script.clues),
        )
    )
    script = result.scalars().first()

    if not script:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script with id {script_id} not found",
        )

    # Build NPC export data with export_id mapping
    npc_id_to_export_id: dict[str, str] = {}
    npcs_export: list[NPCExportData] = []

    for i, npc in enumerate(script.npcs):
        export_id = f"npc_{i + 1}"
        npc_id_to_export_id[npc.id] = export_id
        npcs_export.append(
            NPCExportData(
                export_id=export_id,
                name=npc.name,
                age=npc.age,
                background=npc.background,
                personality=npc.personality,
                knowledge_scope=npc.knowledge_scope or {},
            )
        )

    # Build Clue export data with export_id mapping
    clue_id_to_export_id: dict[str, str] = {}
    clues_export: list[ClueExportData] = []

    for i, clue in enumerate(script.clues):
        export_id = f"clue_{i + 1}"
        clue_id_to_export_id[clue.id] = export_id

    for i, clue in enumerate(script.clues):
        export_id = f"clue_{i + 1}"
        prereq_export_ids = [
            clue_id_to_export_id[pid]
            for pid in (clue.prereq_clue_ids or [])
            if pid in clue_id_to_export_id
        ]
        clues_export.append(
            ClueExportData(
                export_id=export_id,
                name=clue.name,
                type=clue.type,
                detail=clue.detail,
                detail_for_npc=clue.detail_for_npc,
                trigger_keywords=clue.trigger_keywords or [],
                trigger_semantic_summary=clue.trigger_semantic_summary or "",
                npc_export_id=npc_id_to_export_id.get(clue.npc_id, ""),
                prereq_clue_export_ids=prereq_export_ids,
            )
        )

    logger.info(f"Exported script {script_id} with {len(npcs_export)} NPCs and {len(clues_export)} clues")

    return ScriptExportData(
        version="1.0",
        title=script.title,
        summary=script.summary,
        background=script.background,
        difficulty=script.difficulty.value,
        truth=script.truth or {},
        npcs=npcs_export,
        clues=clues_export,
    )


@router.post("/import", response_model=ScriptResponse, status_code=status.HTTP_201_CREATED)
async def import_script(
    db: DBSession,
    request: ScriptImportRequest,
) -> ScriptResponse:
    """Import a script from a JSON bundle, creating all NPCs and clues."""
    from app.models.clue import Clue
    from app.models.npc import NPC

    data = request.data
    title = request.new_title or data.title

    # Create the script
    script = Script(
        id=str(uuid4()),
        title=title,
        summary=data.summary,
        background=data.background,
        difficulty=ScriptDifficulty(data.difficulty),
        truth=data.truth,
    )
    db.add(script)
    await db.flush()

    # Create NPCs and build export_id to real ID mapping
    export_id_to_npc_id: dict[str, str] = {}
    for npc_data in data.npcs:
        npc = NPC(
            id=str(uuid4()),
            script_id=script.id,
            name=npc_data.name,
            age=npc_data.age,
            background=npc_data.background,
            personality=npc_data.personality,
            knowledge_scope=npc_data.knowledge_scope,
        )
        db.add(npc)
        export_id_to_npc_id[npc_data.export_id] = npc.id

    await db.flush()

    # Create Clues - first pass to create all clues and get IDs
    export_id_to_clue_id: dict[str, str] = {}
    clue_objects: list[Clue] = []

    for clue_data in data.clues:
        npc_id = export_id_to_npc_id.get(clue_data.npc_export_id)
        if not npc_id:
            logger.warning(f"Skipping clue {clue_data.name}: NPC export_id {clue_data.npc_export_id} not found")
            continue

        clue = Clue(
            id=str(uuid4()),
            script_id=script.id,
            npc_id=npc_id,
            name=clue_data.name,
            type=clue_data.type,
            detail=clue_data.detail,
            detail_for_npc=clue_data.detail_for_npc,
            trigger_keywords=clue_data.trigger_keywords,
            trigger_semantic_summary=clue_data.trigger_semantic_summary,
            prereq_clue_ids=[],  # Will be set in second pass
        )
        db.add(clue)
        export_id_to_clue_id[clue_data.export_id] = clue.id
        clue_objects.append((clue, clue_data))

    await db.flush()

    # Second pass: set prerequisite clue IDs
    for clue, clue_data in clue_objects:
        prereq_ids = [
            export_id_to_clue_id[eid]
            for eid in clue_data.prereq_clue_export_ids
            if eid in export_id_to_clue_id
        ]
        clue.prereq_clue_ids = prereq_ids

    await db.flush()
    await db.refresh(script)

    logger.info(
        f"Imported script {script.id} with {len(export_id_to_npc_id)} NPCs and {len(export_id_to_clue_id)} clues"
    )

    return ScriptResponse.model_validate(script)
