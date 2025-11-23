"""Algorithm API endpoints."""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.database import DBSession
from app.models.algorithm import (
    AlgorithmImplementation,
    AlgorithmStrategy,
    AlgorithmType,
    StrategyStatus,
    StrategyScopeType,
)
from app.schemas.algorithm import (
    AlgorithmImplementationResponse,
    AlgorithmStrategyCreate,
    AlgorithmStrategyResponse,
    AlgorithmStrategyUpdate,
    GlobalConfigResponse,
    GlobalConfigUpdate,
)
from app.schemas.common import PaginatedResponse, PaginationParams

logger = logging.getLogger(__name__)
router = APIRouter()


# Algorithm Implementation endpoints (read-only)


@router.get("/algorithms", response_model=list[AlgorithmImplementationResponse])
async def list_algorithms(
    db: DBSession,
    type_filter: str | None = Query(default=None, alias="type", description="Filter by type"),
    status_filter: str | None = Query(default=None, alias="status", description="Filter by status"),
) -> list[AlgorithmImplementationResponse]:
    """
    List all algorithm implementations (read-only).

    Args:
        db: Database session.
        type_filter: Filter by algorithm type.
        status_filter: Filter by status.

    Returns:
        List of algorithm implementations.
    """
    query = select(AlgorithmImplementation)

    if type_filter:
        query = query.where(AlgorithmImplementation.type == AlgorithmType(type_filter))

    if status_filter:
        from app.models.algorithm import AlgorithmImplStatus
        query = query.where(AlgorithmImplementation.status == AlgorithmImplStatus(status_filter))

    result = await db.execute(query)
    algorithms = result.scalars().all()

    return [AlgorithmImplementationResponse.model_validate(algo) for algo in algorithms]


# Algorithm Strategy endpoints


@router.get("/strategies", response_model=PaginatedResponse[AlgorithmStrategyResponse])
async def list_strategies(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    impl_id: str | None = Query(default=None, description="Filter by implementation ID"),
    scope_type: str | None = Query(default=None, description="Filter by scope type"),
    status_filter: str | None = Query(default=None, alias="status", description="Filter by status"),
    search: str | None = Query(default=None, description="Search by name"),
) -> PaginatedResponse[AlgorithmStrategyResponse]:
    """
    List all algorithm strategies with pagination and filtering.

    Args:
        db: Database session.
        Various filter parameters.

    Returns:
        Paginated list of strategies.
    """
    pagination = PaginationParams(page=page, page_size=page_size)

    # Build query
    query = select(AlgorithmStrategy)

    if impl_id:
        query = query.where(AlgorithmStrategy.impl_id == impl_id)

    if scope_type:
        query = query.where(AlgorithmStrategy.scope_type == StrategyScopeType(scope_type))

    if status_filter:
        query = query.where(AlgorithmStrategy.status == StrategyStatus(status_filter))

    if search:
        query = query.where(AlgorithmStrategy.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    query = (
        query.order_by(AlgorithmStrategy.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )

    result = await db.execute(query)
    strategies = result.scalars().all()

    items = [AlgorithmStrategyResponse.model_validate(s) for s in strategies]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("/strategies", response_model=AlgorithmStrategyResponse, status_code=status.HTTP_201_CREATED)
async def create_strategy(
    db: DBSession,
    strategy_data: AlgorithmStrategyCreate,
) -> AlgorithmStrategyResponse:
    """
    Create a new algorithm strategy.

    Args:
        db: Database session.
        strategy_data: Strategy creation data.

    Returns:
        Created strategy.

    Raises:
        HTTPException: If implementation not found.
    """
    # Verify implementation exists
    impl_result = await db.execute(
        select(AlgorithmImplementation)
        .where(AlgorithmImplementation.id == strategy_data.impl_id)
    )
    if not impl_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Algorithm implementation with id {strategy_data.impl_id} not found",
        )

    strategy = AlgorithmStrategy(
        id=str(uuid4()),
        name=strategy_data.name,
        description=strategy_data.description,
        impl_id=strategy_data.impl_id,
        scope_type=StrategyScopeType(strategy_data.scope_type),
        scope_target_id=strategy_data.scope_target_id,
        params=strategy_data.params,
        created_by=strategy_data.created_by,
    )

    db.add(strategy)
    await db.flush()
    await db.refresh(strategy)

    logger.info(f"Created strategy: {strategy.id}")
    return AlgorithmStrategyResponse.model_validate(strategy)


@router.get("/strategies/{strategy_id}", response_model=AlgorithmStrategyResponse)
async def get_strategy(
    db: DBSession,
    strategy_id: str,
) -> AlgorithmStrategyResponse:
    """
    Get a strategy by ID.

    Args:
        db: Database session.
        strategy_id: Strategy ID.

    Returns:
        Strategy details.

    Raises:
        HTTPException: If strategy not found.
    """
    result = await db.execute(
        select(AlgorithmStrategy).where(AlgorithmStrategy.id == strategy_id)
    )
    strategy = result.scalars().first()

    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy with id {strategy_id} not found",
        )

    return AlgorithmStrategyResponse.model_validate(strategy)


@router.put("/strategies/{strategy_id}", response_model=AlgorithmStrategyResponse)
async def update_strategy(
    db: DBSession,
    strategy_id: str,
    strategy_data: AlgorithmStrategyUpdate,
) -> AlgorithmStrategyResponse:
    """
    Update an existing strategy.

    Args:
        db: Database session.
        strategy_id: Strategy ID.
        strategy_data: Strategy update data.

    Returns:
        Updated strategy.

    Raises:
        HTTPException: If strategy not found.
    """
    result = await db.execute(
        select(AlgorithmStrategy).where(AlgorithmStrategy.id == strategy_id)
    )
    strategy = result.scalars().first()

    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy with id {strategy_id} not found",
        )

    # Update fields
    update_data = strategy_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "scope_type" and value:
            setattr(strategy, field, StrategyScopeType(value))
        else:
            setattr(strategy, field, value)

    await db.flush()
    await db.refresh(strategy)

    logger.info(f"Updated strategy: {strategy.id}")
    return AlgorithmStrategyResponse.model_validate(strategy)


@router.delete("/strategies/{strategy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_strategy(
    db: DBSession,
    strategy_id: str,
) -> None:
    """
    Delete a strategy.

    Args:
        db: Database session.
        strategy_id: Strategy ID.

    Raises:
        HTTPException: If strategy not found or is default.
    """
    result = await db.execute(
        select(AlgorithmStrategy).where(AlgorithmStrategy.id == strategy_id)
    )
    strategy = result.scalars().first()

    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy with id {strategy_id} not found",
        )

    if strategy.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the default strategy",
        )

    await db.delete(strategy)
    await db.flush()

    logger.info(f"Deleted strategy: {strategy_id}")


@router.put("/strategies/{strategy_id}/publish", response_model=AlgorithmStrategyResponse)
async def publish_strategy(
    db: DBSession,
    strategy_id: str,
) -> AlgorithmStrategyResponse:
    """
    Publish a strategy (change status from draft to published).

    Args:
        db: Database session.
        strategy_id: Strategy ID.

    Returns:
        Published strategy.

    Raises:
        HTTPException: If strategy not found or not in draft status.
    """
    result = await db.execute(
        select(AlgorithmStrategy).where(AlgorithmStrategy.id == strategy_id)
    )
    strategy = result.scalars().first()

    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy with id {strategy_id} not found",
        )

    if strategy.status != StrategyStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Strategy is not in draft status (current: {strategy.status.value})",
        )

    strategy.status = StrategyStatus.PUBLISHED

    await db.flush()
    await db.refresh(strategy)

    logger.info(f"Published strategy: {strategy.id}")
    return AlgorithmStrategyResponse.model_validate(strategy)


# Global Config endpoints


@router.get("/global-config", response_model=GlobalConfigResponse)
async def get_global_config(
    db: DBSession,
) -> GlobalConfigResponse:
    """
    Get global configuration including default strategy.

    Args:
        db: Database session.

    Returns:
        Global configuration.
    """
    result = await db.execute(
        select(AlgorithmStrategy)
        .where(AlgorithmStrategy.is_default == True)  # noqa: E712
        .where(AlgorithmStrategy.scope_type == StrategyScopeType.GLOBAL)
    )
    default_strategy = result.scalars().first()

    if default_strategy:
        return GlobalConfigResponse(
            default_strategy_id=default_strategy.id,
            default_strategy=AlgorithmStrategyResponse.model_validate(default_strategy),
        )

    return GlobalConfigResponse(
        default_strategy_id=None,
        default_strategy=None,
    )


@router.put("/global-config", response_model=GlobalConfigResponse)
async def update_global_config(
    db: DBSession,
    config_data: GlobalConfigUpdate,
) -> GlobalConfigResponse:
    """
    Update global configuration.

    Args:
        db: Database session.
        config_data: New configuration.

    Returns:
        Updated global configuration.

    Raises:
        HTTPException: If strategy not found or not published.
    """
    # Verify new strategy exists and is published
    result = await db.execute(
        select(AlgorithmStrategy)
        .where(AlgorithmStrategy.id == config_data.default_strategy_id)
    )
    new_default = result.scalars().first()

    if not new_default:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy with id {config_data.default_strategy_id} not found",
        )

    if new_default.status != StrategyStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only published strategies can be set as default",
        )

    # Remove current default
    current_default_result = await db.execute(
        select(AlgorithmStrategy)
        .where(AlgorithmStrategy.is_default == True)  # noqa: E712
        .where(AlgorithmStrategy.scope_type == StrategyScopeType.GLOBAL)
    )
    current_default = current_default_result.scalars().first()

    if current_default:
        current_default.is_default = False

    # Set new default
    new_default.is_default = True
    new_default.scope_type = StrategyScopeType.GLOBAL

    await db.flush()
    await db.refresh(new_default)

    logger.info(f"Updated global default strategy to: {new_default.id}")

    return GlobalConfigResponse(
        default_strategy_id=new_default.id,
        default_strategy=AlgorithmStrategyResponse.model_validate(new_default),
    )
