"""LLM Config API endpoints."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.database import DBSession
from app.dependencies.auth import get_current_active_user
from app.models.llm_config import LLMConfig, LLMConfigType
from app.schemas.common import PaginatedResponse
from app.schemas.llm_config import (
    LLMConfigCreate,
    LLMConfigResponse,
    LLMConfigUpdate,
)
from app.utils import generate_llm_config_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/llm-configs", tags=["llm-configs"], dependencies=[Depends(get_current_active_user)])


# ============ CRUD Endpoints ============


@router.get("", response_model=PaginatedResponse[LLMConfigResponse])
async def list_llm_configs(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    type: str | None = Query(default=None),
    search: str | None = Query(default=None),
) -> PaginatedResponse[LLMConfigResponse]:
    """List LLM configs with pagination and filtering."""
    query = select(LLMConfig).where(LLMConfig.deleted_at.is_(None))

    # Apply filters
    if type:
        query = query.where(LLMConfig.type == type)
    if search:
        query = query.where(LLMConfig.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(LLMConfig.updated_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    items = [LLMConfigResponse.from_model(c) for c in result.scalars().all()]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/defaults", response_model=dict[str, LLMConfigResponse | None])
async def get_default_llm_configs(
    db: DBSession,
) -> dict[str, LLMConfigResponse | None]:
    """Get default LLM configs for each type."""
    result = await db.execute(
        select(LLMConfig)
        .where(LLMConfig.deleted_at.is_(None))
        .where(LLMConfig.is_default.is_(True))
    )
    configs = result.scalars().all()

    defaults: dict[str, LLMConfigResponse | None] = {
        "embedding": None,
        "chat": None,
    }

    for c in configs:
        defaults[c.type.value] = LLMConfigResponse.from_model(c)

    return defaults


@router.post("", response_model=LLMConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_llm_config(
    db: DBSession,
    data: LLMConfigCreate,
) -> LLMConfigResponse:
    """Create a new LLM config."""
    # If setting as default, unset other defaults first
    if data.is_default:
        result = await db.execute(
            select(LLMConfig)
            .where(LLMConfig.type == data.type)
            .where(LLMConfig.is_default.is_(True))
        )
        for c in result.scalars().all():
            c.is_default = False

    config = LLMConfig(
        id=generate_llm_config_id(),
        name=data.name,
        type=LLMConfigType(data.type),
        model=data.model,
        base_url=data.base_url,
        api_key=data.api_key,
        is_default=data.is_default,
        options=data.options,
    )
    db.add(config)
    await db.flush()
    await db.refresh(config)

    logger.info(f"Created LLM config {config.id}: {config.name}")
    return LLMConfigResponse.from_model(config)


@router.get("/{config_id}", response_model=LLMConfigResponse)
async def get_llm_config(
    db: DBSession,
    config_id: str,
) -> LLMConfigResponse:
    """Get an LLM config by ID."""
    result = await db.execute(
        select(LLMConfig)
        .where(LLMConfig.id == config_id)
        .where(LLMConfig.deleted_at.is_(None))
    )
    config = result.scalars().first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"LLM config with id {config_id} not found",
        )

    return LLMConfigResponse.from_model(config)


@router.put("/{config_id}", response_model=LLMConfigResponse)
async def update_llm_config(
    db: DBSession,
    config_id: str,
    data: LLMConfigUpdate,
) -> LLMConfigResponse:
    """Update an LLM config."""
    result = await db.execute(
        select(LLMConfig)
        .where(LLMConfig.id == config_id)
        .where(LLMConfig.deleted_at.is_(None))
    )
    config = result.scalars().first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"LLM config with id {config_id} not found",
        )

    # If setting as default, unset other defaults first
    if data.is_default:
        unset_result = await db.execute(
            select(LLMConfig)
            .where(LLMConfig.type == config.type)
            .where(LLMConfig.is_default.is_(True))
            .where(LLMConfig.id != config_id)
        )
        for c in unset_result.scalars().all():
            c.is_default = False

    # Update fields
    if data.name is not None:
        config.name = data.name
    if data.model is not None:
        config.model = data.model
    if data.base_url is not None:
        config.base_url = data.base_url
    if data.api_key is not None:
        config.api_key = data.api_key
    if data.is_default is not None:
        config.is_default = data.is_default
    if data.options is not None:
        config.options = data.options

    await db.flush()
    await db.refresh(config)

    logger.info(f"Updated LLM config {config_id}")
    return LLMConfigResponse.from_model(config)


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_llm_config(
    db: DBSession,
    config_id: str,
) -> None:
    """Soft delete an LLM config."""
    result = await db.execute(
        select(LLMConfig)
        .where(LLMConfig.id == config_id)
        .where(LLMConfig.deleted_at.is_(None))
    )
    config = result.scalars().first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"LLM config with id {config_id} not found",
        )

    config.deleted_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info(f"Soft deleted LLM config {config_id}")


@router.post("/{config_id}/set-default", response_model=LLMConfigResponse)
async def set_default_llm_config(
    db: DBSession,
    config_id: str,
) -> LLMConfigResponse:
    """Set an LLM config as the default for its type."""
    result = await db.execute(
        select(LLMConfig)
        .where(LLMConfig.id == config_id)
        .where(LLMConfig.deleted_at.is_(None))
    )
    config = result.scalars().first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"LLM config with id {config_id} not found",
        )

    # Unset other defaults of the same type
    unset_result = await db.execute(
        select(LLMConfig)
        .where(LLMConfig.type == config.type)
        .where(LLMConfig.is_default.is_(True))
    )
    for c in unset_result.scalars().all():
        c.is_default = False

    config.is_default = True
    await db.flush()
    await db.refresh(config)

    logger.info(f"Set LLM config {config_id} as default for type {config.type.value}")
    return LLMConfigResponse.from_model(config)
