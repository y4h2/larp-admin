"""Script API endpoints."""

import logging
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.database import DBSession
from app.models.script import Script, ScriptDifficulty, ScriptStatus
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.script import ScriptCreate, ScriptListResponse, ScriptResponse, ScriptUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=PaginatedResponse[ScriptListResponse])
async def list_scripts(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Literal["draft", "test", "online"] | None = Query(
        default=None, alias="status"
    ),
    search: str | None = Query(default=None, description="Search by name"),
) -> PaginatedResponse[ScriptListResponse]:
    """
    List all scripts with pagination and filtering.

    Args:
        db: Database session.
        page: Page number (1-indexed).
        page_size: Number of items per page.
        status_filter: Filter by script status.
        search: Search term for script name.

    Returns:
        Paginated list of scripts.
    """
    pagination = PaginationParams(page=page, page_size=page_size)

    # Build query
    query = select(Script).where(Script.deleted_at.is_(None))

    if status_filter:
        query = query.where(Script.status == ScriptStatus(status_filter))

    if search:
        query = query.where(Script.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    query = (
        query.options(
            selectinload(Script.scenes),
            selectinload(Script.npcs),
            selectinload(Script.clues),
        )
        .order_by(Script.updated_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )

    result = await db.execute(query)
    scripts = result.scalars().all()

    # Build response with counts
    items = []
    for script in scripts:
        item = ScriptListResponse(
            id=script.id,
            name=script.name,
            description=script.description,
            status=script.status.value,
            version=script.version,
            player_count=script.player_count,
            expected_duration=script.expected_duration,
            difficulty=script.difficulty.value,
            created_by=script.created_by,
            created_at=script.created_at,
            updated_by=script.updated_by,
            updated_at=script.updated_at,
            deleted_at=script.deleted_at,
            scene_count=len(script.scenes),
            npc_count=len(script.npcs),
            clue_count=len(script.clues),
        )
        items.append(item)

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("", response_model=ScriptResponse, status_code=status.HTTP_201_CREATED)
async def create_script(
    db: DBSession,
    script_data: ScriptCreate,
) -> ScriptResponse:
    """
    Create a new script.

    Args:
        db: Database session.
        script_data: Script creation data.

    Returns:
        Created script.
    """
    script = Script(
        id=str(uuid4()),
        name=script_data.name,
        description=script_data.description,
        player_count=script_data.player_count,
        expected_duration=script_data.expected_duration,
        difficulty=ScriptDifficulty(script_data.difficulty),
        created_by=script_data.created_by,
    )

    db.add(script)
    await db.flush()
    await db.refresh(script)

    logger.info(f"Created script: {script.id}")
    return ScriptResponse.model_validate(script)


@router.get("/{script_id}", response_model=ScriptResponse)
async def get_script(
    db: DBSession,
    script_id: str,
) -> ScriptResponse:
    """
    Get a script by ID.

    Args:
        db: Database session.
        script_id: Script ID.

    Returns:
        Script details.

    Raises:
        HTTPException: If script not found.
    """
    result = await db.execute(
        select(Script)
        .where(Script.id == script_id)
        .where(Script.deleted_at.is_(None))
    )
    script = result.scalars().first()

    if not script:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script with id {script_id} not found",
        )

    return ScriptResponse.model_validate(script)


@router.put("/{script_id}", response_model=ScriptResponse)
async def update_script(
    db: DBSession,
    script_id: str,
    script_data: ScriptUpdate,
) -> ScriptResponse:
    """
    Update an existing script.

    Args:
        db: Database session.
        script_id: Script ID.
        script_data: Script update data.

    Returns:
        Updated script.

    Raises:
        HTTPException: If script not found.
    """
    result = await db.execute(
        select(Script)
        .where(Script.id == script_id)
        .where(Script.deleted_at.is_(None))
    )
    script = result.scalars().first()

    if not script:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script with id {script_id} not found",
        )

    # Update fields
    update_data = script_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "status" and value:
            setattr(script, field, ScriptStatus(value))
        elif field == "difficulty" and value:
            setattr(script, field, ScriptDifficulty(value))
        else:
            setattr(script, field, value)

    # Increment version
    script.version += 1

    await db.flush()
    await db.refresh(script)

    logger.info(f"Updated script: {script.id}")
    return ScriptResponse.model_validate(script)


@router.delete("/{script_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_script(
    db: DBSession,
    script_id: str,
) -> None:
    """
    Soft delete a script.

    Args:
        db: Database session.
        script_id: Script ID.

    Raises:
        HTTPException: If script not found.
    """
    result = await db.execute(
        select(Script)
        .where(Script.id == script_id)
        .where(Script.deleted_at.is_(None))
    )
    script = result.scalars().first()

    if not script:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script with id {script_id} not found",
        )

    # Soft delete
    from datetime import datetime, timezone

    script.deleted_at = datetime.now(timezone.utc)

    await db.flush()
    logger.info(f"Soft deleted script: {script.id}")


@router.post("/{script_id}/copy", response_model=ScriptResponse, status_code=status.HTTP_201_CREATED)
async def copy_script(
    db: DBSession,
    script_id: str,
    new_name: str | None = Query(default=None, description="Name for the copied script"),
    created_by: str | None = Query(default=None, description="Creator of the copy"),
) -> ScriptResponse:
    """
    Create a copy of an existing script.

    Args:
        db: Database session.
        script_id: Script ID to copy.
        new_name: Optional name for the copy.
        created_by: Creator ID for the copy.

    Returns:
        Copied script.

    Raises:
        HTTPException: If source script not found.
    """
    result = await db.execute(
        select(Script)
        .where(Script.id == script_id)
        .where(Script.deleted_at.is_(None))
        .options(
            selectinload(Script.scenes),
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
        name=new_name or f"{source.name} (Copy)",
        description=source.description,
        status=ScriptStatus.DRAFT,
        version=1,
        player_count=source.player_count,
        expected_duration=source.expected_duration,
        difficulty=source.difficulty,
        created_by=created_by,
    )

    db.add(new_script)
    await db.flush()
    await db.refresh(new_script)

    logger.info(f"Copied script {script_id} to {new_script.id}")
    return ScriptResponse.model_validate(new_script)
