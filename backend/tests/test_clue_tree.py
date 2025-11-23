"""Tests for Clue Tree service."""

from typing import Any

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_clue(
    client: AsyncClient, script_data: dict[str, Any], clue_data: dict[str, Any]
) -> None:
    """Test creating a new clue."""
    # Create a script first
    script_response = await client.post("/api/scripts", json=script_data)
    script_id = script_response.json()["id"]

    clue_data["script_id"] = script_id
    response = await client.post("/api/clues", json=clue_data)

    assert response.status_code == 201
    data = response.json()
    assert data["title_internal"] == clue_data["title_internal"]
    assert data["clue_type"] == clue_data["clue_type"]
    assert data["importance"] == clue_data["importance"]


@pytest.mark.asyncio
async def test_list_clues(
    client: AsyncClient, script_data: dict[str, Any], clue_data: dict[str, Any]
) -> None:
    """Test listing clues with filters."""
    # Create a script and clue
    script_response = await client.post("/api/scripts", json=script_data)
    script_id = script_response.json()["id"]

    clue_data["script_id"] = script_id
    await client.post("/api/clues", json=clue_data)

    response = await client.get("/api/clues", params={"script_id": script_id})

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1


@pytest.mark.asyncio
async def test_create_clue_relation(
    client: AsyncClient, script_data: dict[str, Any], clue_data: dict[str, Any]
) -> None:
    """Test creating a clue relation."""
    # Create a script
    script_response = await client.post("/api/scripts", json=script_data)
    script_id = script_response.json()["id"]

    # Create two clues
    clue_data["script_id"] = script_id
    clue1_response = await client.post("/api/clues", json=clue_data)
    clue1_id = clue1_response.json()["id"]

    clue_data["title_internal"] = "Second Clue"
    clue2_response = await client.post("/api/clues", json=clue_data)
    clue2_id = clue2_response.json()["id"]

    # Create relation
    relation_data = {
        "prerequisite_clue_id": clue1_id,
        "dependent_clue_id": clue2_id,
        "relation_type": "required",
    }
    response = await client.post("/api/clue-relations", json=relation_data)

    assert response.status_code == 201
    data = response.json()
    assert data["prerequisite_clue_id"] == clue1_id
    assert data["dependent_clue_id"] == clue2_id


@pytest.mark.asyncio
async def test_prevent_self_reference(
    client: AsyncClient, script_data: dict[str, Any], clue_data: dict[str, Any]
) -> None:
    """Test that a clue cannot be its own prerequisite."""
    # Create a script and clue
    script_response = await client.post("/api/scripts", json=script_data)
    script_id = script_response.json()["id"]

    clue_data["script_id"] = script_id
    clue_response = await client.post("/api/clues", json=clue_data)
    clue_id = clue_response.json()["id"]

    # Try to create self-reference
    relation_data = {
        "prerequisite_clue_id": clue_id,
        "dependent_clue_id": clue_id,
        "relation_type": "required",
    }
    response = await client.post("/api/clue-relations", json=relation_data)

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_get_clue_tree(
    client: AsyncClient, script_data: dict[str, Any], clue_data: dict[str, Any]
) -> None:
    """Test getting the clue tree structure."""
    # Create a script
    script_response = await client.post("/api/scripts", json=script_data)
    script_id = script_response.json()["id"]

    # Create clues
    clue_data["script_id"] = script_id
    await client.post("/api/clues", json=clue_data)

    response = await client.get(f"/api/scripts/{script_id}/clue-tree")

    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) >= 1


@pytest.mark.asyncio
async def test_validate_clue_tree(
    client: AsyncClient, script_data: dict[str, Any], clue_data: dict[str, Any]
) -> None:
    """Test validating the clue tree."""
    # Create a script
    script_response = await client.post("/api/scripts", json=script_data)
    script_id = script_response.json()["id"]

    # Create a single clue (orphan)
    clue_data["script_id"] = script_id
    await client.post("/api/clues", json=clue_data)

    response = await client.get(f"/api/scripts/{script_id}/clue-tree/validate")

    assert response.status_code == 200
    data = response.json()
    assert "is_valid" in data
    assert "cycles" in data
    assert "dead_clues" in data
    assert "orphan_clues" in data
