"""Tests for NPC API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.fixture
def npc_create_data(script_id: str) -> dict:
    """Sample NPC creation data."""
    return {
        "script_id": script_id,
        "name": "John Doe",
        "age": 35,
        "background": "A mysterious butler who has served the mansion for 10 years.",
        "personality": "Reserved, formal, but hiding something.",
        "knowledge_scope": {
            "knows": ["victim_location", "house_layout"],
            "does_not_know": ["murder_time"],
            "world_model_limits": ["cannot_access_garden"],
        },
    }


@pytest.fixture
async def script_id(client: AsyncClient) -> str:
    """Create a script and return its ID."""
    response = await client.post(
        "/api/scripts",
        json={
            "title": "Test Murder Mystery",
            "summary": "A test script",
            "background": "A dark and stormy night...",
            "difficulty": "medium",
            "truth": {"murderer": "butler"},
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


class TestNPCCreate:
    """Tests for NPC creation."""

    async def test_create_npc_success(
        self, client: AsyncClient, script_id: str, npc_create_data: dict
    ):
        """Test successful NPC creation."""
        response = await client.post("/api/npcs", json=npc_create_data)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "John Doe"
        assert data["age"] == 35
        assert data["script_id"] == script_id
        assert data["knowledge_scope"]["knows"] == ["victim_location", "house_layout"]
        assert "id" in data
        assert "created_at" in data

    async def test_create_npc_with_invalid_script(
        self, client: AsyncClient, npc_create_data: dict
    ):
        """Test NPC creation with non-existent script."""
        npc_create_data["script_id"] = "non-existent-id"
        response = await client.post("/api/npcs", json=npc_create_data)

        assert response.status_code == 404
        assert "Script" in response.json()["detail"]

    async def test_create_npc_minimal_data(
        self, client: AsyncClient, script_id: str
    ):
        """Test NPC creation with minimal required data."""
        response = await client.post(
            "/api/npcs",
            json={
                "script_id": script_id,
                "name": "Minimal NPC",
                "knowledge_scope": {},
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Minimal NPC"
        assert data["age"] is None
        assert data["background"] is None


class TestNPCList:
    """Tests for NPC listing."""

    async def test_list_npcs_empty(self, client: AsyncClient):
        """Test listing NPCs when none exist."""
        response = await client.get("/api/npcs")

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_list_npcs_with_data(
        self, client: AsyncClient, script_id: str, npc_create_data: dict
    ):
        """Test listing NPCs after creation."""
        # Create multiple NPCs
        await client.post("/api/npcs", json=npc_create_data)
        npc_create_data["name"] = "Jane Doe"
        await client.post("/api/npcs", json=npc_create_data)

        response = await client.get("/api/npcs")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    async def test_list_npcs_filter_by_script(
        self, client: AsyncClient, script_id: str, npc_create_data: dict
    ):
        """Test filtering NPCs by script_id."""
        await client.post("/api/npcs", json=npc_create_data)

        response = await client.get(f"/api/npcs?script_id={script_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["script_id"] == script_id

    async def test_list_npcs_search_by_name(
        self, client: AsyncClient, script_id: str, npc_create_data: dict
    ):
        """Test searching NPCs by name."""
        await client.post("/api/npcs", json=npc_create_data)
        npc_create_data["name"] = "Jane Smith"
        await client.post("/api/npcs", json=npc_create_data)

        response = await client.get("/api/npcs?search=John")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == "John Doe"

    async def test_list_npcs_pagination(
        self, client: AsyncClient, script_id: str, npc_create_data: dict
    ):
        """Test NPC listing pagination."""
        # Create 5 NPCs
        for i in range(5):
            npc_create_data["name"] = f"NPC {i}"
            await client.post("/api/npcs", json=npc_create_data)

        # Get first page
        response = await client.get("/api/npcs?page=1&page_size=2")
        data = response.json()
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert data["total_pages"] == 3

        # Get second page
        response = await client.get("/api/npcs?page=2&page_size=2")
        data = response.json()
        assert len(data["items"]) == 2
        assert data["page"] == 2


class TestNPCGet:
    """Tests for getting a single NPC."""

    async def test_get_npc_success(
        self, client: AsyncClient, script_id: str, npc_create_data: dict
    ):
        """Test getting an NPC by ID."""
        create_response = await client.post("/api/npcs", json=npc_create_data)
        npc_id = create_response.json()["id"]

        response = await client.get(f"/api/npcs/{npc_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == npc_id
        assert data["name"] == "John Doe"

    async def test_get_npc_not_found(self, client: AsyncClient):
        """Test getting a non-existent NPC."""
        response = await client.get("/api/npcs/non-existent-id")

        assert response.status_code == 404
        assert "NPC" in response.json()["detail"]


class TestNPCUpdate:
    """Tests for NPC updates."""

    async def test_update_npc_success(
        self, client: AsyncClient, script_id: str, npc_create_data: dict
    ):
        """Test updating an NPC."""
        create_response = await client.post("/api/npcs", json=npc_create_data)
        npc_id = create_response.json()["id"]

        response = await client.put(
            f"/api/npcs/{npc_id}",
            json={
                "name": "Updated Name",
                "age": 40,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["age"] == 40
        # Unchanged fields should remain
        assert data["background"] == npc_create_data["background"]

    async def test_update_npc_knowledge_scope(
        self, client: AsyncClient, script_id: str, npc_create_data: dict
    ):
        """Test updating NPC knowledge scope."""
        create_response = await client.post("/api/npcs", json=npc_create_data)
        npc_id = create_response.json()["id"]

        new_knowledge = {
            "knows": ["new_info"],
            "does_not_know": ["secret"],
            "world_model_limits": ["limited"],
        }
        response = await client.put(
            f"/api/npcs/{npc_id}",
            json={"knowledge_scope": new_knowledge},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["knowledge_scope"]["knows"] == ["new_info"]
        assert data["knowledge_scope"]["does_not_know"] == ["secret"]

    async def test_update_npc_not_found(self, client: AsyncClient):
        """Test updating a non-existent NPC."""
        response = await client.put(
            "/api/npcs/non-existent-id",
            json={"name": "New Name"},
        )

        assert response.status_code == 404

    async def test_update_npc_partial(
        self, client: AsyncClient, script_id: str, npc_create_data: dict
    ):
        """Test partial update only changes specified fields."""
        create_response = await client.post("/api/npcs", json=npc_create_data)
        npc_id = create_response.json()["id"]

        # Only update name
        response = await client.put(
            f"/api/npcs/{npc_id}",
            json={"name": "Only Name Changed"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Only Name Changed"
        assert data["age"] == 35  # Original value preserved
        assert data["background"] == npc_create_data["background"]


class TestNPCDelete:
    """Tests for NPC deletion."""

    async def test_delete_npc_success(
        self, client: AsyncClient, script_id: str, npc_create_data: dict
    ):
        """Test deleting an NPC."""
        create_response = await client.post("/api/npcs", json=npc_create_data)
        npc_id = create_response.json()["id"]

        response = await client.delete(f"/api/npcs/{npc_id}")
        assert response.status_code == 204

        # Verify NPC is deleted
        get_response = await client.get(f"/api/npcs/{npc_id}")
        assert get_response.status_code == 404

    async def test_delete_npc_not_found(self, client: AsyncClient):
        """Test deleting a non-existent NPC."""
        response = await client.delete("/api/npcs/non-existent-id")
        assert response.status_code == 404
