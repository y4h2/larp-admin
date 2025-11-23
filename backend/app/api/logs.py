"""Dialogue log API endpoints."""

import logging
from datetime import datetime

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.database import DBSession
from app.models.log import DialogueLog
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.log import DialogueLogResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=PaginatedResponse[DialogueLogResponse])
async def list_logs(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    script_id: str | None = Query(default=None, description="Filter by script ID"),
    scene_id: str | None = Query(default=None, description="Filter by scene ID"),
    npc_id: str | None = Query(default=None, description="Filter by NPC ID"),
    strategy_id: str | None = Query(default=None, description="Filter by strategy ID"),
    start_date: datetime | None = Query(default=None, description="Filter from date"),
    end_date: datetime | None = Query(default=None, description="Filter to date"),
) -> PaginatedResponse[DialogueLogResponse]:
    """
    List dialogue logs with pagination and filtering.

    Args:
        db: Database session.
        Various filter parameters.

    Returns:
        Paginated list of dialogue logs.
    """
    pagination = PaginationParams(page=page, page_size=page_size)

    # Build query
    query = select(DialogueLog)

    if script_id:
        query = query.where(DialogueLog.script_id == script_id)

    if scene_id:
        query = query.where(DialogueLog.scene_id == scene_id)

    if npc_id:
        query = query.where(DialogueLog.npc_id == npc_id)

    if strategy_id:
        query = query.where(DialogueLog.strategy_id == strategy_id)

    if start_date:
        query = query.where(DialogueLog.created_at >= start_date)

    if end_date:
        query = query.where(DialogueLog.created_at <= end_date)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    query = (
        query.order_by(DialogueLog.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )

    result = await db.execute(query)
    logs = result.scalars().all()

    items = [DialogueLogResponse.model_validate(log) for log in logs]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
