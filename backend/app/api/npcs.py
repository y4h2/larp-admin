"""NPC API endpoints based on data/sample/clue.py."""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.database import DBSession
from app.models.npc import NPC
from app.models.script import Script
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.npc import NPCCreate, NPCResponse, NPCUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=PaginatedResponse[NPCResponse])
async def list_npcs(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    script_id: str | None = Query(default=None, description="Filter by script ID"),
    search: str | None = Query(default=None, description="Search by name"),
) -> PaginatedResponse[NPCResponse]:
    """List all NPCs with pagination and filtering."""
    pagination = PaginationParams(page=page, page_size=page_size)

    query = select(NPC)

    if script_id:
        query = query.where(NPC.script_id == script_id)

    if search:
        query = query.where(NPC.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    query = (
        query.order_by(NPC.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )

    result = await db.execute(query)
    npcs = result.scalars().all()

    items = [NPCResponse.model_validate(npc) for npc in npcs]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("", response_model=NPCResponse, status_code=status.HTTP_201_CREATED)
async def create_npc(
    db: DBSession,
    npc_data: NPCCreate,
) -> NPCResponse:
    """Create a new NPC."""
    # Verify script exists
    script_result = await db.execute(
        select(Script)
        .where(Script.id == npc_data.script_id)
        .where(Script.deleted_at.is_(None))
    )
    if not script_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script with id {npc_data.script_id} not found",
        )

    npc = NPC(
        id=str(uuid4()),
        script_id=npc_data.script_id,
        name=npc_data.name,
        age=npc_data.age,
        background=npc_data.background,
        personality=npc_data.personality,
        knowledge_scope=npc_data.knowledge_scope.model_dump(),
    )

    db.add(npc)
    await db.flush()
    await db.refresh(npc)

    logger.info(f"Created NPC: {npc.id}")
    return NPCResponse.model_validate(npc)


@router.get("/{npc_id}", response_model=NPCResponse)
async def get_npc(
    db: DBSession,
    npc_id: str,
) -> NPCResponse:
    """Get an NPC by ID."""
    result = await db.execute(select(NPC).where(NPC.id == npc_id))
    npc = result.scalars().first()

    if not npc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NPC with id {npc_id} not found",
        )

    return NPCResponse.model_validate(npc)


@router.put("/{npc_id}", response_model=NPCResponse)
async def update_npc(
    db: DBSession,
    npc_id: str,
    npc_data: NPCUpdate,
) -> NPCResponse:
    """Update an existing NPC."""
    result = await db.execute(select(NPC).where(NPC.id == npc_id))
    npc = result.scalars().first()

    if not npc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NPC with id {npc_id} not found",
        )

    # Update fields
    update_data = npc_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Convert nested Pydantic models to dict for JSONB fields
        if field == "knowledge_scope" and value is not None:
            value = value if isinstance(value, dict) else value
        setattr(npc, field, value)

    await db.flush()
    await db.refresh(npc)

    logger.info(f"Updated NPC: {npc.id}")
    return NPCResponse.model_validate(npc)


@router.delete("/{npc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_npc(
    db: DBSession,
    npc_id: str,
) -> None:
    """Delete an NPC."""
    result = await db.execute(select(NPC).where(NPC.id == npc_id))
    npc = result.scalars().first()

    if not npc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NPC with id {npc_id} not found",
        )

    await db.delete(npc)
    await db.flush()

    logger.info(f"Deleted NPC: {npc_id}")
