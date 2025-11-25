"""Clue API endpoints based on data/sample/clue.py."""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.database import DBSession
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
from app.schemas.common import PaginatedResponse, PaginationParams
from app.services.clue_tree import ClueTreeService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/clues", response_model=PaginatedResponse[ClueResponse])
async def list_clues(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    script_id: str | None = Query(default=None, description="Filter by script ID"),
    npc_id: str | None = Query(default=None, description="Filter by NPC ID"),
    type_filter: str | None = Query(default=None, alias="type", description="Filter by type"),
    search: str | None = Query(default=None, description="Search by name"),
) -> PaginatedResponse[ClueResponse]:
    """List all clues with pagination and filtering."""
    pagination = PaginationParams(page=page, page_size=page_size)

    query = select(Clue)

    if script_id:
        query = query.where(Clue.script_id == script_id)

    if npc_id:
        query = query.where(Clue.npc_id == npc_id)

    if type_filter:
        query = query.where(Clue.type == ClueType(type_filter))

    if search:
        query = query.where(Clue.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    query = (
        query.order_by(Clue.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )

    result = await db.execute(query)
    clues = result.scalars().all()

    items = [ClueResponse.model_validate(clue) for clue in clues]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("/clues", response_model=ClueResponse, status_code=status.HTTP_201_CREATED)
async def create_clue(
    db: DBSession,
    clue_data: ClueCreate,
) -> ClueResponse:
    """Create a new clue."""
    # Verify script exists
    script_result = await db.execute(
        select(Script)
        .where(Script.id == clue_data.script_id)
        .where(Script.deleted_at.is_(None))
    )
    if not script_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script with id {clue_data.script_id} not found",
        )

    # Verify NPC exists
    npc_result = await db.execute(
        select(NPC).where(NPC.id == clue_data.npc_id)
    )
    if not npc_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NPC with id {clue_data.npc_id} not found",
        )

    clue = Clue(
        id=str(uuid4()),
        script_id=clue_data.script_id,
        npc_id=clue_data.npc_id,
        name=clue_data.name,
        type=ClueType(clue_data.type),
        detail=clue_data.detail,
        detail_for_npc=clue_data.detail_for_npc,
        trigger_keywords=clue_data.trigger_keywords,
        trigger_semantic_summary=clue_data.trigger_semantic_summary,
        prereq_clue_ids=clue_data.prereq_clue_ids,
    )

    db.add(clue)
    await db.flush()
    await db.refresh(clue)

    logger.info(f"Created clue: {clue.id}")
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
    clue_data: ClueUpdate,
) -> ClueResponse:
    """Update an existing clue."""
    result = await db.execute(select(Clue).where(Clue.id == clue_id))
    clue = result.scalars().first()

    if not clue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clue with id {clue_id} not found",
        )

    # Update fields
    update_data = clue_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "type" and value:
            setattr(clue, field, ClueType(value))
        else:
            setattr(clue, field, value)

    await db.flush()
    await db.refresh(clue)

    logger.info(f"Updated clue: {clue.id}")
    return ClueResponse.model_validate(clue)


@router.put("/clues/{clue_id}/dependencies", response_model=ClueResponse)
async def update_clue_dependencies(
    db: DBSession,
    clue_id: str,
    data: dict,
) -> ClueResponse:
    """Update the prerequisite clue IDs for a clue."""
    result = await db.execute(select(Clue).where(Clue.id == clue_id))
    clue = result.scalars().first()

    if not clue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clue with id {clue_id} not found",
        )

    new_prereq_ids = data.get("prereq_clue_ids", [])

    # Validate all prerequisite clues exist
    for prereq_id in new_prereq_ids:
        prereq_result = await db.execute(select(Clue).where(Clue.id == prereq_id))
        if not prereq_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prerequisite clue with id {prereq_id} not found",
            )

    # Prevent self-reference
    if clue_id in new_prereq_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A clue cannot depend on itself",
        )

    # Check for cycles using DFS
    all_clues_result = await db.execute(
        select(Clue).where(Clue.script_id == clue.script_id)
    )
    all_clues = list(all_clues_result.scalars().all())

    # Build adjacency list (prereq -> dependents)
    adjacency: dict[str, list[str]] = {}
    for c in all_clues:
        if c.id == clue_id:
            for prereq_id in new_prereq_ids:
                if prereq_id not in adjacency:
                    adjacency[prereq_id] = []
                adjacency[prereq_id].append(c.id)
        else:
            for prereq_id in c.prereq_clue_ids or []:
                if prereq_id not in adjacency:
                    adjacency[prereq_id] = []
                adjacency[prereq_id].append(c.id)

    def has_cycle_to(start: str, target: str, visited: set) -> bool:
        if start == target:
            return True
        if start in visited:
            return False
        visited.add(start)
        for neighbor in adjacency.get(start, []):
            if has_cycle_to(neighbor, target, visited):
                return True
        return False

    for prereq_id in new_prereq_ids:
        if has_cycle_to(clue_id, prereq_id, set()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Adding prerequisite {prereq_id} would create a circular dependency",
            )

    clue.prereq_clue_ids = new_prereq_ids
    await db.flush()
    await db.refresh(clue)

    logger.info(f"Updated clue dependencies: {clue.id}")
    return ClueResponse.model_validate(clue)


@router.delete("/clues/{clue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_clue(
    db: DBSession,
    clue_id: str,
) -> None:
    """Delete a clue."""
    result = await db.execute(select(Clue).where(Clue.id == clue_id))
    clue = result.scalars().first()

    if not clue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clue with id {clue_id} not found",
        )

    await db.delete(clue)
    await db.flush()

    logger.info(f"Deleted clue: {clue_id}")


# Clue Tree endpoints


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
