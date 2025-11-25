"""LLM Configuration API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.llm_config import LLMConfig, LLMConfigType
from app.schemas.common import PaginatedResponse
from app.schemas.llm_config import (
    LLMConfigCreate,
    LLMConfigListResponse,
    LLMConfigResponse,
    LLMConfigUpdate,
)

router = APIRouter(prefix="/llm-configs", tags=["LLM Configurations"])


@router.get("", response_model=PaginatedResponse[LLMConfigListResponse])
async def list_llm_configs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    type: str | None = Query(None, description="Filter by type (embedding or chat)"),
    search: str | None = Query(None, description="Search by name"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[LLMConfigListResponse]:
    """List all LLM configurations with pagination."""
    query = select(LLMConfig).where(LLMConfig.deleted_at.is_(None))

    if type:
        query = query.where(LLMConfig.type == type)

    if search:
        query = query.where(LLMConfig.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Get paginated results
    query = query.order_by(LLMConfig.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    configs = result.scalars().all()

    return PaginatedResponse(
        items=[LLMConfigListResponse.from_model(c) for c in configs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=LLMConfigResponse, status_code=201)
async def create_llm_config(
    config_in: LLMConfigCreate,
    db: AsyncSession = Depends(get_db),
) -> LLMConfigResponse:
    """Create a new LLM configuration."""
    # If setting as default, unset other defaults of the same type
    if config_in.is_default:
        await _unset_default_for_type(db, config_in.type)

    config = LLMConfig(
        name=config_in.name,
        type=LLMConfigType(config_in.type),
        model=config_in.model,
        base_url=config_in.base_url,
        api_key=config_in.api_key,
        is_default=config_in.is_default,
        options=config_in.options,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)

    return LLMConfigResponse.from_model(config)


@router.get("/defaults", response_model=dict[str, LLMConfigResponse | None])
async def get_default_configs(
    db: AsyncSession = Depends(get_db),
) -> dict[str, LLMConfigResponse | None]:
    """Get the default configurations for each type."""
    result = {}

    for config_type in LLMConfigType:
        query = select(LLMConfig).where(
            LLMConfig.deleted_at.is_(None),
            LLMConfig.type == config_type,
            LLMConfig.is_default.is_(True),
        )
        config = (await db.execute(query)).scalar_one_or_none()
        result[config_type.value] = (
            LLMConfigResponse.from_model(config) if config else None
        )

    return result


@router.get("/{config_id}", response_model=LLMConfigResponse)
async def get_llm_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
) -> LLMConfigResponse:
    """Get a specific LLM configuration by ID."""
    query = select(LLMConfig).where(
        LLMConfig.id == config_id,
        LLMConfig.deleted_at.is_(None),
    )
    config = (await db.execute(query)).scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="LLM configuration not found")

    return LLMConfigResponse.from_model(config)


@router.put("/{config_id}", response_model=LLMConfigResponse)
async def update_llm_config(
    config_id: str,
    config_in: LLMConfigUpdate,
    db: AsyncSession = Depends(get_db),
) -> LLMConfigResponse:
    """Update an existing LLM configuration."""
    query = select(LLMConfig).where(
        LLMConfig.id == config_id,
        LLMConfig.deleted_at.is_(None),
    )
    config = (await db.execute(query)).scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="LLM configuration not found")

    # If setting as default, unset other defaults of the same type
    if config_in.is_default is True and not config.is_default:
        await _unset_default_for_type(db, config.type.value)

    # Update fields
    update_data = config_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    await db.commit()
    await db.refresh(config)

    return LLMConfigResponse.from_model(config)


@router.delete("/{config_id}", status_code=204)
async def delete_llm_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft delete an LLM configuration."""
    query = select(LLMConfig).where(
        LLMConfig.id == config_id,
        LLMConfig.deleted_at.is_(None),
    )
    config = (await db.execute(query)).scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="LLM configuration not found")

    config.deleted_at = func.now()
    await db.commit()


@router.post("/{config_id}/set-default", response_model=LLMConfigResponse)
async def set_default_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
) -> LLMConfigResponse:
    """Set a configuration as the default for its type."""
    query = select(LLMConfig).where(
        LLMConfig.id == config_id,
        LLMConfig.deleted_at.is_(None),
    )
    config = (await db.execute(query)).scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="LLM configuration not found")

    # Unset other defaults of the same type
    await _unset_default_for_type(db, config.type.value)

    # Set this one as default
    config.is_default = True
    await db.commit()
    await db.refresh(config)

    return LLMConfigResponse.from_model(config)


async def _unset_default_for_type(db: AsyncSession, config_type: str) -> None:
    """Unset is_default for all configs of the given type."""
    query = select(LLMConfig).where(
        LLMConfig.deleted_at.is_(None),
        LLMConfig.type == config_type,
        LLMConfig.is_default.is_(True),
    )
    result = await db.execute(query)
    configs = result.scalars().all()

    for config in configs:
        config.is_default = False
