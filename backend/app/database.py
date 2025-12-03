"""Database configuration and session management."""

import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import settings


def _unique_statement_name() -> str:
    """Generate unique prepared statement name to avoid conflicts with pgbouncer."""
    return f"__asyncpg_{uuid.uuid4().hex[:12]}__"


# Create async engine
# Note: For Supabase/pgbouncer in transaction mode, we need to disable prepared statements
# Using NullPool because pgbouncer handles connection pooling
# Using unique statement names to avoid conflicts when pgbouncer switches backend connections
engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    future=True,
    poolclass=NullPool,  # Let pgbouncer handle pooling
    connect_args={
        "statement_cache_size": 0,  # Disable asyncpg prepared statement cache
        "prepared_statement_name_func": _unique_statement_name,  # Unique names for pgbouncer
    },
)

# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that provides an async database session.

    Yields:
        AsyncSession: An async SQLAlchemy session.
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# Type alias for dependency injection
DBSession = Annotated[AsyncSession, Depends(get_db)]
