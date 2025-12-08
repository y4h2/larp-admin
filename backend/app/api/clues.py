"""Clue API endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.database import DBSession
from app.dependencies.auth import get_current_active_user
from app.models.clue import Clue, ClueType
from app.models.npc import NPC
from app.models.script import Script
from app.schemas.clue import (
    ClueCreate,
    ClueResponse,
    ClueTreeEdge,
    ClueTreeIssues,
    ClueTreeNode,
    ClueTreeResponse,
    ClueUpdate,
)
from app.schemas.common import PaginatedResponse
from app.services.clue_tree import ClueTreeService
from app.utils import generate_clue_id

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_active_user)])


# ============ CRUD Endpoints ============


@router.get("/clues", response_model=PaginatedResponse[ClueResponse])
async def list_clues(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    script_id: str | None = Query(default=None),
    npc_id: str | None = Query(default=None),
    type: str | None = Query(default=None),
    search: str | None = Query(default=None),
) -> PaginatedResponse[ClueResponse]:
    """List clues with pagination and filtering."""
    query = select(Clue)

    # Apply filters
    if script_id:
        query = query.where(Clue.script_id == script_id)
    if npc_id:
        query = query.where(Clue.npc_id == npc_id)
    if type:
        query = query.where(Clue.type == type)
    if search:
        query = query.where(Clue.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(Clue.updated_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    items = [ClueResponse.model_validate(c) for c in result.scalars().all()]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/clues", response_model=ClueResponse, status_code=status.HTTP_201_CREATED)
async def create_clue(
    db: DBSession,
    data: ClueCreate,
) -> ClueResponse:
    """Create a new clue."""
    # Verify script exists
    script_result = await db.execute(
        select(Script)
        .where(Script.id == data.script_id)
        .where(Script.deleted_at.is_(None))
    )
    if not script_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script with id {data.script_id} not found",
        )

    # Verify NPC exists
    npc_result = await db.execute(select(NPC).where(NPC.id == data.npc_id))
    if not npc_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NPC with id {data.npc_id} not found",
        )

    clue = Clue(
        id=generate_clue_id(),
        script_id=data.script_id,
        npc_id=data.npc_id,
        name=data.name,
        type=ClueType(data.type),
        detail=data.detail,
        detail_for_npc=data.detail_for_npc,
        trigger_keywords=data.trigger_keywords,
        trigger_semantic_summary=data.trigger_semantic_summary,
        prereq_clue_ids=data.prereq_clue_ids,
    )
    db.add(clue)
    await db.flush()
    await db.refresh(clue)

    logger.info(f"Created clue {clue.id}: {clue.name}")
    return ClueResponse.model_validate(clue)


@router.get("/clues/{clue_id}", response_model=ClueResponse)
async def get_clue(
    db: DBSession,
    clue_id: str,
) -> ClueResponse:
    """Get a clue by ID."""
    result = await db.execute(select(Clue).where(Clue.id == clue_id))
    clue = result.scalars().first()

    if not clue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clue with id {clue_id} not found",
        )

    return ClueResponse.model_validate(clue)


@router.put("/clues/{clue_id}", response_model=ClueResponse)
async def update_clue(
    db: DBSession,
    clue_id: str,
    data: ClueUpdate,
) -> ClueResponse:
    """Update a clue."""
    result = await db.execute(select(Clue).where(Clue.id == clue_id))
    clue = result.scalars().first()

    if not clue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clue with id {clue_id} not found",
        )

    # Verify NPC exists if being changed
    if data.npc_id is not None:
        npc_result = await db.execute(select(NPC).where(NPC.id == data.npc_id))
        if not npc_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"NPC with id {data.npc_id} not found",
            )

    # Update fields
    if data.name is not None:
        clue.name = data.name
    if data.type is not None:
        clue.type = ClueType(data.type)
    if data.detail is not None:
        clue.detail = data.detail
    if data.detail_for_npc is not None:
        clue.detail_for_npc = data.detail_for_npc
    if data.trigger_keywords is not None:
        clue.trigger_keywords = data.trigger_keywords
    if data.trigger_semantic_summary is not None:
        clue.trigger_semantic_summary = data.trigger_semantic_summary
    if data.prereq_clue_ids is not None:
        clue.prereq_clue_ids = data.prereq_clue_ids
    if data.npc_id is not None:
        clue.npc_id = data.npc_id

    await db.flush()
    await db.refresh(clue)

    logger.info(f"Updated clue {clue_id}")
    return ClueResponse.model_validate(clue)


@router.delete("/clues/{clue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_clue(
    db: DBSession,
    clue_id: str,
) -> None:
    """Delete a clue (hard delete)."""
    result = await db.execute(select(Clue).where(Clue.id == clue_id))
    clue = result.scalars().first()

    if not clue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clue with id {clue_id} not found",
        )

    await db.delete(clue)
    await db.flush()

    logger.info(f"Deleted clue {clue_id}")


# ============ Clue Tree Endpoints ============


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
