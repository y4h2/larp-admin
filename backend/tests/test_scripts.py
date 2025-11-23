"""Tests for Script API endpoints."""

from typing import Any

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_script(client: AsyncClient, script_data: dict[str, Any]) -> None:
    """Test creating a new script."""
    response = await client.post("/api/scripts", json=script_data)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == script_data["name"]
    assert data["description"] == script_data["description"]
    assert data["status"] == "draft"
    assert data["version"] == 1
    assert "id" in data


@pytest.mark.asyncio
async def test_list_scripts(client: AsyncClient, script_data: dict[str, Any]) -> None:
    """Test listing scripts with pagination."""
    # Create a script first
    await client.post("/api/scripts", json=script_data)

    response = await client.get("/api/scripts")

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert len(data["items"]) >= 1


@pytest.mark.asyncio
async def test_get_script(client: AsyncClient, script_data: dict[str, Any]) -> None:
    """Test getting a specific script."""
    # Create a script first
    create_response = await client.post("/api/scripts", json=script_data)
    script_id = create_response.json()["id"]

    response = await client.get(f"/api/scripts/{script_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == script_id
    assert data["name"] == script_data["name"]


@pytest.mark.asyncio
async def test_get_script_not_found(client: AsyncClient) -> None:
    """Test getting a non-existent script."""
    response = await client.get("/api/scripts/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_script(client: AsyncClient, script_data: dict[str, Any]) -> None:
    """Test updating a script."""
    # Create a script first
    create_response = await client.post("/api/scripts", json=script_data)
    script_id = create_response.json()["id"]

    update_data = {"name": "Updated Name", "status": "test"}
    response = await client.put(f"/api/scripts/{script_id}", json=update_data)

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["status"] == "test"
    assert data["version"] == 2  # Version should increment


@pytest.mark.asyncio
async def test_delete_script(client: AsyncClient, script_data: dict[str, Any]) -> None:
    """Test soft deleting a script."""
    # Create a script first
    create_response = await client.post("/api/scripts", json=script_data)
    script_id = create_response.json()["id"]

    response = await client.delete(f"/api/scripts/{script_id}")

    assert response.status_code == 204

    # Verify it's no longer accessible
    get_response = await client.get(f"/api/scripts/{script_id}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_copy_script(client: AsyncClient, script_data: dict[str, Any]) -> None:
    """Test copying a script."""
    # Create a script first
    create_response = await client.post("/api/scripts", json=script_data)
    script_id = create_response.json()["id"]

    response = await client.post(
        f"/api/scripts/{script_id}/copy",
        params={"new_name": "Copied Script"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Copied Script"
    assert data["status"] == "draft"
    assert data["version"] == 1
    assert data["id"] != script_id


@pytest.mark.asyncio
async def test_filter_scripts_by_status(
    client: AsyncClient, script_data: dict[str, Any]
) -> None:
    """Test filtering scripts by status."""
    # Create a script
    await client.post("/api/scripts", json=script_data)

    response = await client.get("/api/scripts", params={"status": "draft"})

    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["status"] == "draft"


@pytest.mark.asyncio
async def test_search_scripts(client: AsyncClient, script_data: dict[str, Any]) -> None:
    """Test searching scripts by name."""
    # Create a script
    await client.post("/api/scripts", json=script_data)

    response = await client.get("/api/scripts", params={"search": "Murder"})

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
