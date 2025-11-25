"""Script API endpoints based on data/sample/clue.py."""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.database import DBSession
from app.models.script import Script, ScriptDifficulty
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.script import ScriptCreate, ScriptListResponse, ScriptResponse, ScriptUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=PaginatedResponse[ScriptListResponse])
async def list_scripts(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    difficulty: str | None = Query(default=None, description="Filter by difficulty"),
    search: str | None = Query(default=None, description="Search by title"),
) -> PaginatedResponse[ScriptListResponse]:
    """List all scripts with pagination and filtering."""
    pagination = PaginationParams(page=page, page_size=page_size)

    query = select(Script).where(Script.deleted_at.is_(None))

    if difficulty:
        query = query.where(Script.difficulty == ScriptDifficulty(difficulty))

    if search:
        query = query.where(Script.title.ilike(f"%{search}%"))

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
            title=script.title,
            summary=script.summary,
            background=script.background,
            difficulty=script.difficulty.value,
            truth=script.truth,
            created_at=script.created_at,
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
    """Create a new script."""
    script = Script(
        id=str(uuid4()),
        title=script_data.title,
        summary=script_data.summary,
        background=script_data.background,
        difficulty=ScriptDifficulty(script_data.difficulty),
        truth=script_data.truth,
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
    """Get a script by ID."""
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
    """Update an existing script."""
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
        if field == "difficulty" and value:
            setattr(script, field, ScriptDifficulty(value))
        else:
            setattr(script, field, value)

    await db.flush()
    await db.refresh(script)

    logger.info(f"Updated script: {script.id}")
    return ScriptResponse.model_validate(script)


@router.delete("/{script_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_script(
    db: DBSession,
    script_id: str,
) -> None:
    """Soft delete a script."""
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
    new_title: str | None = Query(default=None, description="Title for the copied script"),
) -> ScriptResponse:
    """Create a copy of an existing script."""
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
