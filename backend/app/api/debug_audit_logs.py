"""Debug audit log API endpoints."""

import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.database import DBSession
from app.dependencies.auth import get_current_active_user
from app.models.debug_audit_log import DebugAuditLog, LogLevel
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.debug_audit_log import DebugAuditLogCreate, DebugAuditLogResponse

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_active_user)])


@router.get("", response_model=PaginatedResponse[DebugAuditLogResponse])
async def list_debug_audit_logs(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    level: str | None = Query(default=None, description="Filter by log level"),
    source: str | None = Query(default=None, description="Filter by source"),
    request_id: str | None = Query(default=None, description="Filter by request ID"),
    user_id: str | None = Query(default=None, description="Filter by user ID"),
    search: str | None = Query(default=None, description="Search in message"),
) -> PaginatedResponse[DebugAuditLogResponse]:
    """List all debug audit logs with pagination and filtering."""
    pagination = PaginationParams(page=page, page_size=page_size)

    query = select(DebugAuditLog)

    if level:
        query = query.where(DebugAuditLog.level == LogLevel(level))

    if source:
        query = query.where(DebugAuditLog.source.ilike(f"%{source}%"))

    if request_id:
        query = query.where(DebugAuditLog.request_id == request_id)

    if user_id:
        query = query.where(DebugAuditLog.user_id == user_id)

    if search:
        query = query.where(DebugAuditLog.message.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results (newest first)
    query = (
        query.order_by(DebugAuditLog.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )

    result = await db.execute(query)
    logs = result.scalars().all()

    items = [DebugAuditLogResponse.model_validate(log) for log in logs]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("", response_model=DebugAuditLogResponse, status_code=status.HTTP_201_CREATED)
async def create_debug_audit_log(
    db: DBSession,
    log_data: DebugAuditLogCreate,
) -> DebugAuditLogResponse:
    """Create a new debug audit log entry."""
    log = DebugAuditLog(
        id=str(uuid4()),
        level=LogLevel(log_data.level),
        source=log_data.source,
        message=log_data.message,
        context=log_data.context,
        request_id=log_data.request_id,
        user_id=log_data.user_id,
    )

    db.add(log)
    await db.flush()
    await db.refresh(log)

    logger.info(f"Created debug audit log: {log.id}")
    return DebugAuditLogResponse.model_validate(log)


@router.get("/{log_id}", response_model=DebugAuditLogResponse)
async def get_debug_audit_log(
    db: DBSession,
    log_id: str,
) -> DebugAuditLogResponse:
    """Get a debug audit log by ID."""
    result = await db.execute(select(DebugAuditLog).where(DebugAuditLog.id == log_id))
    log = result.scalars().first()

    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Debug audit log with id {log_id} not found",
        )

    return DebugAuditLogResponse.model_validate(log)


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_debug_audit_log(
    db: DBSession,
    log_id: str,
) -> None:
    """Delete a debug audit log entry."""
    result = await db.execute(select(DebugAuditLog).where(DebugAuditLog.id == log_id))
    log = result.scalars().first()

    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Debug audit log with id {log_id} not found",
        )

    await db.delete(log)
    await db.flush()

    logger.info(f"Deleted debug audit log: {log_id}")


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear_debug_audit_logs(
    db: DBSession,
    level: str | None = Query(default=None, description="Clear logs of specific level only"),
) -> None:
    """Clear all debug audit logs (optionally filtered by level)."""
    query = select(DebugAuditLog)

    if level:
        query = query.where(DebugAuditLog.level == LogLevel(level))

    result = await db.execute(query)
    logs = result.scalars().all()

    for log in logs:
        await db.delete(log)

    await db.flush()

    logger.info(f"Cleared {len(logs)} debug audit logs")
