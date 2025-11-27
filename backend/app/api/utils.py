"""Common utility functions for API endpoints.

This module provides reusable utilities to reduce code duplication across API routes.
"""

from typing import TypeVar

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base

T = TypeVar("T", bound=Base)


async def get_or_404(
    db: AsyncSession,
    model: type[T],
    resource_id: str,
    *,
    include_deleted: bool = False,
    error_message: str | None = None,
) -> T:
    """Get a resource by ID or raise 404 if not found.

    Args:
        db: Database session
        model: SQLAlchemy model class
        resource_id: ID of the resource to fetch
        include_deleted: Whether to include soft-deleted records
        error_message: Custom error message (defaults to "{ModelName} not found")

    Returns:
        The model instance

    Raises:
        HTTPException: 404 if resource not found
    """
    query = select(model).where(model.id == resource_id)

    # Check for soft delete support
    if hasattr(model, "deleted_at") and not include_deleted:
        query = query.where(model.deleted_at.is_(None))

    result = await db.execute(query)
    instance = result.scalars().first()

    if not instance:
        model_name = model.__name__
        detail = error_message or f"{model_name} with id {resource_id} not found"
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )

    return instance


async def get_paginated_count(
    db: AsyncSession,
    query,
) -> int:
    """Get total count for a paginated query.

    Args:
        db: Database session
        query: SQLAlchemy select query

    Returns:
        Total count of matching records
    """
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    return result.scalar() or 0


async def soft_delete(
    db: AsyncSession,
    instance: T,
    *,
    commit: bool = True,
) -> None:
    """Soft delete a model instance by setting deleted_at.

    Args:
        db: Database session
        instance: Model instance to soft delete
        commit: Whether to commit the transaction (default True)

    Raises:
        ValueError: If model doesn't support soft delete
    """
    if not hasattr(instance, "deleted_at"):
        raise ValueError(f"{type(instance).__name__} does not support soft delete")

    instance.deleted_at = func.now()

    if commit:
        await db.commit()
    else:
        await db.flush()


async def unset_default_for_type(
    db: AsyncSession,
    model: type[T],
    type_value: str,
    *,
    type_field: str = "type",
) -> None:
    """Unset is_default for all records of a given type.

    This is commonly used for templates and LLM configs where only one
    record of each type should be the default.

    Args:
        db: Database session
        model: SQLAlchemy model class
        type_value: The type value to filter by
        type_field: Name of the type field (default "type")
    """
    query = select(model).where(
        model.deleted_at.is_(None) if hasattr(model, "deleted_at") else True,
        getattr(model, type_field) == type_value,
        model.is_default.is_(True),
    )
    result = await db.execute(query)
    instances = result.scalars().all()

    for instance in instances:
        instance.is_default = False

    await db.flush()


def apply_search_filter(query, model, search: str | None, field_name: str = "name"):
    """Apply ilike search filter to a query.

    Args:
        query: SQLAlchemy select query
        model: SQLAlchemy model class
        search: Search string (can be None)
        field_name: Name of the field to search (default "name")

    Returns:
        Modified query with search filter applied
    """
    if search:
        field = getattr(model, field_name)
        query = query.where(field.ilike(f"%{search}%"))
    return query


async def verify_exists(
    db: AsyncSession,
    model: type[T],
    resource_id: str,
    *,
    error_message: str | None = None,
) -> bool:
    """Verify that a resource exists.

    Args:
        db: Database session
        model: SQLAlchemy model class
        resource_id: ID of the resource to verify

    Returns:
        True if exists

    Raises:
        HTTPException: 404 if resource not found
    """
    query = select(model).where(model.id == resource_id)

    if hasattr(model, "deleted_at"):
        query = query.where(model.deleted_at.is_(None))

    result = await db.execute(query)
    instance = result.scalars().first()

    if not instance:
        model_name = model.__name__
        detail = error_message or f"{model_name} with id {resource_id} not found"
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )

    return True
