"""Clue API endpoints - clue tree only.

CRUD operations are now handled via Supabase PostgREST.
Only clue tree endpoint is kept here for complex graph operations.
"""

import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.database import DBSession
from app.models.clue import Clue
from app.models.script import Script
from app.schemas.clue import (
    ClueTreeEdge,
    ClueTreeIssues,
    ClueTreeNode,
    ClueTreeResponse,
)
from app.services.clue_tree import ClueTreeService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/scripts/{script_id}/clue-tree", response_model=ClueTreeResponse)
async def get_clue_tree(
    db: DBSession,
    script_id: str,
) -> ClueTreeResponse:
    """Get the clue tree structure for a script."""
    # Verify script exists
    script_result = await db.execute(
        select(Script)
        .where(Script.id == script_id)
        .where(Script.deleted_at.is_(None))
    )
    if not script_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script with id {script_id} not found",
        )

    # Get all clues for the script
    clues_result = await db.execute(
        select(Clue).where(Clue.script_id == script_id)
    )
    clues = list(clues_result.scalars().all())

    # Build reverse dependency map (prereq_id -> list of dependent clue ids)
    dependent_map: dict[str, list[str]] = {}
    for clue in clues:
        for prereq_id in clue.prereq_clue_ids or []:
            if prereq_id not in dependent_map:
                dependent_map[prereq_id] = []
            dependent_map[prereq_id].append(clue.id)

    # Build nodes with all fields
    nodes = [
        ClueTreeNode(
            id=clue.id,
            name=clue.name,
            type=clue.type.value,
            npc_id=clue.npc_id,
            prereq_clue_ids=clue.prereq_clue_ids or [],
            dependent_clue_ids=dependent_map.get(clue.id, []),
            detail=clue.detail,
            trigger_keywords=clue.trigger_keywords or [],
            created_at=clue.created_at.isoformat() if clue.created_at else None,
            updated_at=clue.updated_at.isoformat() if clue.updated_at else None,
        )
        for clue in clues
    ]

    # Build edges
    edges = []
    for clue in clues:
        for prereq_id in clue.prereq_clue_ids or []:
            edges.append(ClueTreeEdge(source=prereq_id, target=clue.id))

    # Validate tree and get issues
    tree_service = ClueTreeService(db)
    validation = await tree_service.validate_clue_tree(script_id)
    issues = ClueTreeIssues(
        dead_clues=validation.dead_clues,
        orphan_clues=validation.orphan_clues,
        cycles=validation.cycles,
    )

    return ClueTreeResponse(nodes=nodes, edges=edges, issues=issues)
