"""Scene API endpoints."""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.database import DBSession
from app.models.scene import Scene, SceneType
from app.models.script import Script
from app.schemas.common import PaginatedResponse
from app.schemas.scene import SceneCreate, SceneReorder, SceneResponse, SceneUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/scenes", response_model=PaginatedResponse[SceneResponse])
async def list_scenes_by_query(
    db: DBSession,
    script_id: str,
) -> PaginatedResponse[SceneResponse]:
    """
    List all scenes for a script (query param version).

    Args:
        db: Database session.
        script_id: Script ID as query parameter.

    Returns:
        Paginated list of scenes ordered by sort_order.

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

    result = await db.execute(
        select(Scene)
        .where(Scene.script_id == script_id)
        .order_by(Scene.sort_order)
    )
    scenes = result.scalars().all()
    items = [SceneResponse.model_validate(scene) for scene in scenes]

    return PaginatedResponse.create(
        items=items,
        total=len(items),
        page=1,
        page_size=len(items) or 1,
    )


@router.get("/scripts/{script_id}/scenes", response_model=list[SceneResponse])
async def list_scenes(
    db: DBSession,
    script_id: str,
) -> list[SceneResponse]:
    """
    List all scenes for a script.

    Args:
        db: Database session.
        script_id: Script ID.

    Returns:
        List of scenes ordered by sort_order.

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

    result = await db.execute(
        select(Scene)
        .where(Scene.script_id == script_id)
        .order_by(Scene.sort_order)
    )
    scenes = result.scalars().all()

    return [SceneResponse.model_validate(scene) for scene in scenes]


@router.post(
    "/scripts/{script_id}/scenes",
    response_model=SceneResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_scene(
    db: DBSession,
    script_id: str,
    scene_data: SceneCreate,
) -> SceneResponse:
    """
    Create a new scene in a script.

    Args:
        db: Database session.
        script_id: Script ID.
        scene_data: Scene creation data.

    Returns:
        Created scene.

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

    # Get max sort_order if not specified
    if scene_data.sort_order == 0:
        max_order_result = await db.execute(
            select(Scene.sort_order)
            .where(Scene.script_id == script_id)
            .order_by(Scene.sort_order.desc())
            .limit(1)
        )
        max_order = max_order_result.scalar()
        sort_order = (max_order or 0) + 1
    else:
        sort_order = scene_data.sort_order

    scene = Scene(
        id=str(uuid4()),
        script_id=script_id,
        name=scene_data.name,
        description=scene_data.description,
        scene_type=SceneType(scene_data.scene_type),
        sort_order=sort_order,
    )

    db.add(scene)
    await db.flush()
    await db.refresh(scene)

    logger.info(f"Created scene: {scene.id} in script: {script_id}")
    return SceneResponse.model_validate(scene)


@router.put("/scenes/{scene_id}", response_model=SceneResponse)
async def update_scene(
    db: DBSession,
    scene_id: str,
    scene_data: SceneUpdate,
) -> SceneResponse:
    """
    Update an existing scene.

    Args:
        db: Database session.
        scene_id: Scene ID.
        scene_data: Scene update data.

    Returns:
        Updated scene.

    Raises:
        HTTPException: If scene not found.
    """
    result = await db.execute(select(Scene).where(Scene.id == scene_id))
    scene = result.scalars().first()

    if not scene:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scene with id {scene_id} not found",
        )

    # Update fields
    update_data = scene_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "scene_type" and value:
            setattr(scene, field, SceneType(value))
        else:
            setattr(scene, field, value)

    await db.flush()
    await db.refresh(scene)

    logger.info(f"Updated scene: {scene.id}")
    return SceneResponse.model_validate(scene)


@router.delete("/scenes/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scene(
    db: DBSession,
    scene_id: str,
) -> None:
    """
    Delete a scene.

    Args:
        db: Database session.
        scene_id: Scene ID.

    Raises:
        HTTPException: If scene not found.
    """
    result = await db.execute(select(Scene).where(Scene.id == scene_id))
    scene = result.scalars().first()

    if not scene:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scene with id {scene_id} not found",
        )

    await db.delete(scene)
    await db.flush()

    logger.info(f"Deleted scene: {scene_id}")


@router.put("/scripts/{script_id}/scenes/reorder", response_model=list[SceneResponse])
async def reorder_scenes(
    db: DBSession,
    script_id: str,
    reorder_data: SceneReorder,
) -> list[SceneResponse]:
    """
    Reorder scenes in a script.

    Args:
        db: Database session.
        script_id: Script ID.
        reorder_data: New order of scene IDs.

    Returns:
        Reordered scenes.

    Raises:
        HTTPException: If script not found or scene IDs invalid.
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

    # Get all scenes for this script
    result = await db.execute(
        select(Scene).where(Scene.script_id == script_id)
    )
    scenes = {scene.id: scene for scene in result.scalars().all()}

    # Validate all scene IDs
    for scene_id in reorder_data.scene_ids:
        if scene_id not in scenes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Scene with id {scene_id} not found in script {script_id}",
            )

    # Update sort orders
    for index, scene_id in enumerate(reorder_data.scene_ids):
        scenes[scene_id].sort_order = index

    await db.flush()

    # Return reordered scenes
    return [
        SceneResponse.model_validate(scenes[scene_id])
        for scene_id in reorder_data.scene_ids
    ]
