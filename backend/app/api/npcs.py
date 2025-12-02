"""NPC API endpoints."""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.database import DBSession
from app.models.npc import NPC
from app.models.script import Script
from app.schemas.common import PaginatedResponse
from app.schemas.npc import NPCCreate, NPCResponse, NPCUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=PaginatedResponse[NPCResponse])
async def list_npcs(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    script_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
) -> PaginatedResponse[NPCResponse]:
    """List NPCs with pagination and filtering."""
    query = select(NPC)

    # Apply filters
    if script_id:
        query = query.where(NPC.script_id == script_id)
    if search:
        query = query.where(NPC.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(NPC.updated_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    items = [NPCResponse.model_validate(n) for n in result.scalars().all()]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=NPCResponse, status_code=status.HTTP_201_CREATED)
async def create_npc(
    db: DBSession,
    data: NPCCreate,
) -> NPCResponse:
    """Create a new NPC."""
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

    npc = NPC(
        id=str(uuid4()),
        script_id=data.script_id,
        name=data.name,
        age=data.age,
        background=data.background,
        personality=data.personality,
        knowledge_scope=data.knowledge_scope or {},
    )
    db.add(npc)
    await db.flush()
    await db.refresh(npc)

    logger.info(f"Created NPC {npc.id}: {npc.name}")
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
    data: NPCUpdate,
) -> NPCResponse:
    """Update an NPC."""
    result = await db.execute(select(NPC).where(NPC.id == npc_id))
    npc = result.scalars().first()

    if not npc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NPC with id {npc_id} not found",
        )

    # Update fields
    if data.name is not None:
        npc.name = data.name
    if data.age is not None:
        npc.age = data.age
    if data.background is not None:
        npc.background = data.background
    if data.personality is not None:
        npc.personality = data.personality
    if data.knowledge_scope is not None:
        npc.knowledge_scope = data.knowledge_scope

    await db.flush()
    await db.refresh(npc)

    logger.info(f"Updated NPC {npc_id}")
    return NPCResponse.model_validate(npc)


@router.delete("/{npc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_npc(
    db: DBSession,
    npc_id: str,
) -> None:
    """Delete an NPC (hard delete)."""
    result = await db.execute(select(NPC).where(NPC.id == npc_id))
    npc = result.scalars().first()

    if not npc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NPC with id {npc_id} not found",
        )

    await db.delete(npc)
    await db.flush()

    logger.info(f"Deleted NPC {npc_id}")
