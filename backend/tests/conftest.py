"""Pytest fixtures for testing."""

from collections.abc import AsyncGenerator
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.types import JSON, Text

from app.database import Base, get_db
from app.main import app


# Use SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


def _set_sqlite_pragma(dbapi_conn, connection_record):
    """Enable foreign keys for SQLite."""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def _make_model_sqlite_compatible():
    """Convert PostgreSQL-specific types to SQLite-compatible types."""
    # Walk through all mapped columns and convert types
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, JSONB):
                column.type = JSON()
            elif isinstance(column.type, ARRAY):
                # SQLite doesn't support arrays, store as JSON
                column.type = JSON()


@pytest.fixture
async def async_engine():
    """Create an async engine for testing."""
    # Make models SQLite-compatible before creating tables
    _make_model_sqlite_compatible()

    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
    )

    # Add SQLite-specific pragmas
    event.listen(engine.sync_engine, "connect", _set_sqlite_pragma)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a database session for testing."""
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session_maker() as session:
        yield session


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with database session override."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def script_data() -> dict[str, Any]:
    """Sample script data for testing."""
    return {
        "name": "Test Murder Mystery",
        "description": "A test script for the murder mystery game",
        "player_count": 1,
        "expected_duration": 60,
        "difficulty": "medium",
        "created_by": "test_user",
    }


@pytest.fixture
def scene_data() -> dict[str, Any]:
    """Sample scene data for testing."""
    return {
        "name": "Crime Scene",
        "description": "The main crime scene investigation",
        "scene_type": "investigation",
        "sort_order": 1,
    }


@pytest.fixture
def npc_data() -> dict[str, Any]:
    """Sample NPC data for testing."""
    return {
        "name": "John Doe",
        "name_en": "John Doe",
        "age": 35,
        "job": "Butler",
        "role_type": "suspect",
        "personality": "Reserved and formal",
        "speech_style": "Speaks in a formal manner",
        "background_story": "Has worked at the mansion for 10 years",
        "relations": {"victim": "employer"},
        "system_prompt_template": "You are {name}, a {job} who is being questioned.",
        "extra_prompt_vars": {},
        "created_by": "test_user",
    }


@pytest.fixture
def clue_data() -> dict[str, Any]:
    """Sample clue data for testing."""
    return {
        "title_internal": "Bloody Knife",
        "title_player": "A bloodstained knife",
        "content_text": "You found a knife with dried blood on the blade.",
        "content_type": "text",
        "content_payload": {},
        "clue_type": "evidence",
        "importance": "critical",
        "stage": 1,
        "npc_ids": [],
        "unlock_conditions": {
            "keywords": {
                "must_have": ["knife", "search"],
                "should_have": ["weapon", "blood"],
                "blacklist": [],
                "min_matches": 1,
            }
        },
        "effects": {},
        "one_time": False,
        "created_by": "test_user",
    }


@pytest.fixture
def strategy_data() -> dict[str, Any]:
    """Sample strategy data for testing."""
    return {
        "name": "Test Strategy",
        "description": "A test matching strategy",
        "impl_id": "keyword_v1",
        "scope_type": "global",
        "scope_target_id": None,
        "params": {"trigger_threshold": 0.5},
        "created_by": "test_user",
    }
