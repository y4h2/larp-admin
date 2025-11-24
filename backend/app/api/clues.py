"""Clue API endpoints."""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.database import DBSession
from app.models.clue import (
    Clue,
    ClueImportance,
    ClueRelation,
    ClueRelationType,
    ClueStatus,
    ClueType,
    ContentType,
)
from app.models.scene import Scene
from app.models.script import Script
from app.schemas.clue import (
    ClueCreate,
    ClueRelationCreate,
    ClueRelationResponse,
    ClueResponse,
    ClueTreeResponse,
    ClueTreeValidation,
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
    scene_id: str | None = Query(default=None, description="Filter by scene ID"),
    npc_id: str | None = Query(default=None, description="Filter by NPC ID"),
    stage: int | None = Query(default=None, description="Filter by stage"),
    status_filter: str | None = Query(default=None, alias="status", description="Filter by status"),
    clue_type: str | None = Query(default=None, description="Filter by clue type"),
    importance: str | None = Query(default=None, description="Filter by importance"),
    search: str | None = Query(default=None, description="Search by title"),
) -> PaginatedResponse[ClueResponse]:
    """
    List all clues with pagination and filtering.

    Args:
        db: Database session.
        Various filter parameters.

    Returns:
        Paginated list of clues.
    """
    pagination = PaginationParams(page=page, page_size=page_size)

    # Build query
    query = select(Clue)

    if script_id:
        query = query.where(Clue.script_id == script_id)

    if scene_id:
        query = query.where(Clue.scene_id == scene_id)

    if npc_id:
        query = query.where(Clue.npc_ids.contains([npc_id]))

    if stage:
        query = query.where(Clue.stage == stage)

    if status_filter:
        query = query.where(Clue.status == ClueStatus(status_filter))

    if clue_type:
        query = query.where(Clue.clue_type == ClueType(clue_type))

    if importance:
        query = query.where(Clue.importance == ClueImportance(importance))

    if search:
        query = query.where(
            (Clue.title_internal.ilike(f"%{search}%"))
            | (Clue.title_player.ilike(f"%{search}%"))
        )

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    query = (
        query.order_by(Clue.stage, Clue.created_at.desc())
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
    """
    Create a new clue.

    Args:
        db: Database session.
        clue_data: Clue creation data.

    Returns:
        Created clue.

    Raises:
        HTTPException: If script or scene not found.
    """
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

    # Verify scene exists if provided
    if clue_data.scene_id:
        scene_result = await db.execute(
            select(Scene).where(Scene.id == clue_data.scene_id)
        )
        if not scene_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene with id {clue_data.scene_id} not found",
            )

    clue = Clue(
        id=str(uuid4()),
        script_id=clue_data.script_id,
        scene_id=clue_data.scene_id,
        title_internal=clue_data.title_internal,
        title_player=clue_data.title_player,
        content_text=clue_data.content_text,
        content_type=ContentType(clue_data.content_type),
        content_payload=clue_data.content_payload,
        clue_type=ClueType(clue_data.clue_type),
        importance=ClueImportance(clue_data.importance),
        stage=clue_data.stage,
        npc_ids=clue_data.npc_ids,
        unlock_conditions=clue_data.unlock_conditions,
        effects=clue_data.effects,
        one_time=clue_data.one_time,
        created_by=clue_data.created_by,
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
    """
    Get a clue by ID.

    Args:
        db: Database session.
        clue_id: Clue ID.

    Returns:
        Clue details.

    Raises:
        HTTPException: If clue not found.
    """
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
    """
    Update an existing clue.

    Args:
        db: Database session.
        clue_id: Clue ID.
        clue_data: Clue update data.

    Returns:
        Updated clue.

    Raises:
        HTTPException: If clue not found.
    """
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
        if field == "content_type" and value:
            setattr(clue, field, ContentType(value))
        elif field == "clue_type" and value:
            setattr(clue, field, ClueType(value))
        elif field == "importance" and value:
            setattr(clue, field, ClueImportance(value))
        elif field == "status" and value:
            setattr(clue, field, ClueStatus(value))
        else:
            setattr(clue, field, value)

    # Increment version
    clue.version += 1

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
    """
    Update the prerequisite clue IDs for a clue.

    Args:
        db: Database session.
        clue_id: Clue ID.
        data: Dictionary with prerequisite_clue_ids list.

    Returns:
        Updated clue.

    Raises:
        HTTPException: If clue not found or would create a cycle.
    """
    result = await db.execute(select(Clue).where(Clue.id == clue_id))
    clue = result.scalars().first()

    if not clue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clue with id {clue_id} not found",
        )

    new_prereq_ids = data.get("prerequisite_clue_ids", [])

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
    # Get all clues in the same script to build the graph
    all_clues_result = await db.execute(
        select(Clue).where(Clue.script_id == clue.script_id)
    )
    all_clues = list(all_clues_result.scalars().all())

    # Build adjacency list (prereq -> dependents)
    adjacency: dict[str, list[str]] = {}
    for c in all_clues:
        if c.id == clue_id:
            # Use new prereq_ids for the clue being updated
            for prereq_id in new_prereq_ids:
                if prereq_id not in adjacency:
                    adjacency[prereq_id] = []
                adjacency[prereq_id].append(c.id)
        else:
            for prereq_id in c.prereq_clue_ids or []:
                if prereq_id not in adjacency:
                    adjacency[prereq_id] = []
                adjacency[prereq_id].append(c.id)

    # DFS to detect cycles starting from each new prerequisite
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

    # Check if any path from clue_id leads back to any prerequisite
    for prereq_id in new_prereq_ids:
        if has_cycle_to(clue_id, prereq_id, set()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Adding prerequisite {prereq_id} would create a circular dependency",
            )

    # Update the clue
    clue.prereq_clue_ids = new_prereq_ids
    clue.version += 1

    await db.flush()
    await db.refresh(clue)

    logger.info(f"Updated clue dependencies: {clue.id}")
    return ClueResponse.model_validate(clue)


@router.delete("/clues/{clue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_clue(
    db: DBSession,
    clue_id: str,
) -> None:
    """
    Delete a clue.

    Args:
        db: Database session.
        clue_id: Clue ID.

    Raises:
        HTTPException: If clue not found.
    """
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


@router.get("/clues/{clue_id}/history")
async def get_clue_history(
    db: DBSession,
    clue_id: str,
) -> dict:
    """
    Get version history for a clue.

    Note: Full version history would require an audit table.
    This endpoint returns current version info as a placeholder.

    Args:
        db: Database session.
        clue_id: Clue ID.

    Returns:
        Version history info.

    Raises:
        HTTPException: If clue not found.
    """
    result = await db.execute(select(Clue).where(Clue.id == clue_id))
    clue = result.scalars().first()

    if not clue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clue with id {clue_id} not found",
        )

    # Placeholder: In production, this would query an audit table
    return {
        "clue_id": clue.id,
        "current_version": clue.version,
        "created_at": clue.created_at.isoformat(),
        "updated_at": clue.updated_at.isoformat(),
        "created_by": clue.created_by,
        "updated_by": clue.updated_by,
        "versions": [
            {
                "version": clue.version,
                "timestamp": clue.updated_at.isoformat(),
                "updated_by": clue.updated_by,
            }
        ],
    }


# Clue Tree endpoints


@router.get("/scripts/{script_id}/clue-tree", response_model=ClueTreeResponse)
async def get_clue_tree(
    db: DBSession,
    script_id: str,
) -> ClueTreeResponse:
    """
    Get the clue tree structure for a script.

    Args:
        db: Database session.
        script_id: Script ID.

    Returns:
        Clue tree with nodes and edges.

    Raises:
        HTTPException: If script not found.
    """
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

    service = ClueTreeService(db)
    return await service.get_clue_tree(script_id)


@router.get("/scripts/{script_id}/clue-tree/validate", response_model=ClueTreeValidation)
async def validate_clue_tree(
    db: DBSession,
    script_id: str,
) -> ClueTreeValidation:
    """
    Validate the clue tree for a script.

    Checks for cycles, dead clues, and orphan clues.

    Args:
        db: Database session.
        script_id: Script ID.

    Returns:
        Validation results.

    Raises:
        HTTPException: If script not found.
    """
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

    service = ClueTreeService(db)
    return await service.validate_clue_tree(script_id)


# Clue Relations endpoints


@router.post(
    "/clue-relations",
    response_model=ClueRelationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_clue_relation(
    db: DBSession,
    relation_data: ClueRelationCreate,
) -> ClueRelationResponse:
    """
    Create a new clue relation.

    Args:
        db: Database session.
        relation_data: Relation creation data.

    Returns:
        Created relation.

    Raises:
        HTTPException: If clues not found or relation already exists.
    """
    # Verify both clues exist
    prereq_result = await db.execute(
        select(Clue).where(Clue.id == relation_data.prerequisite_clue_id)
    )
    if not prereq_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prerequisite clue with id {relation_data.prerequisite_clue_id} not found",
        )

    dependent_result = await db.execute(
        select(Clue).where(Clue.id == relation_data.dependent_clue_id)
    )
    if not dependent_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dependent clue with id {relation_data.dependent_clue_id} not found",
        )

    # Check if relation already exists
    existing_result = await db.execute(
        select(ClueRelation)
        .where(ClueRelation.prerequisite_clue_id == relation_data.prerequisite_clue_id)
        .where(ClueRelation.dependent_clue_id == relation_data.dependent_clue_id)
    )
    if existing_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Relation already exists",
        )

    # Prevent self-reference
    if relation_data.prerequisite_clue_id == relation_data.dependent_clue_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A clue cannot be its own prerequisite",
        )

    relation = ClueRelation(
        id=str(uuid4()),
        prerequisite_clue_id=relation_data.prerequisite_clue_id,
        dependent_clue_id=relation_data.dependent_clue_id,
        relation_type=ClueRelationType(relation_data.relation_type),
    )

    db.add(relation)
    await db.flush()
    await db.refresh(relation)

    logger.info(f"Created clue relation: {relation.id}")
    return ClueRelationResponse.model_validate(relation)


@router.delete("/clue-relations/{relation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_clue_relation(
    db: DBSession,
    relation_id: str,
) -> None:
    """
    Delete a clue relation.

    Args:
        db: Database session.
        relation_id: Relation ID.

    Raises:
        HTTPException: If relation not found.
    """
    result = await db.execute(
        select(ClueRelation).where(ClueRelation.id == relation_id)
    )
    relation = result.scalars().first()

    if not relation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clue relation with id {relation_id} not found",
        )

    await db.delete(relation)
    await db.flush()

    logger.info(f"Deleted clue relation: {relation_id}")
