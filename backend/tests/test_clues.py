"""Tests for Clue API endpoints."""

import pytest
from httpx import AsyncClient


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


@pytest.fixture
async def npc_id(client: AsyncClient, script_id: str) -> str:
    """Create an NPC and return its ID."""
    response = await client.post(
        "/api/npcs",
        json={
            "script_id": script_id,
            "name": "John the Butler",
            "age": 45,
            "background": "Served the family for 20 years",
            "personality": "Formal and reserved",
            "knowledge_scope": {"knows": ["house_layout"]},
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


@pytest.fixture
def clue_create_data(script_id: str, npc_id: str) -> dict:
    """Sample clue creation data."""
    return {
        "script_id": script_id,
        "npc_id": npc_id,
        "name": "Bloody Knife",
        "type": "text",
        "detail": "A knife with dried blood on the blade.",
        "detail_for_npc": "I found this knife in the kitchen...",
        "trigger_keywords": ["knife", "weapon", "blood"],
        "trigger_semantic_summary": "Questions about weapons or murder evidence",
        "prereq_clue_ids": [],
    }


class TestClueCreate:
    """Tests for clue creation."""

    async def test_create_clue_success(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test successful clue creation."""
        response = await client.post("/api/clues", json=clue_create_data)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Bloody Knife"
        assert data["type"] == "text"
        assert data["detail"] == clue_create_data["detail"]
        assert data["trigger_keywords"] == ["knife", "weapon", "blood"]
        assert "id" in data
        assert "created_at" in data

    async def test_create_clue_with_invalid_script(
        self, client: AsyncClient, npc_id: str
    ):
        """Test clue creation with non-existent script."""
        response = await client.post(
            "/api/clues",
            json={
                "script_id": "non-existent-id",
                "npc_id": npc_id,
                "name": "Test Clue",
                "type": "text",
                "detail": "Test detail",
                "detail_for_npc": "How to reveal this clue",
                "trigger_keywords": [],
                "prereq_clue_ids": [],
            },
        )

        assert response.status_code == 404
        assert "Script" in response.json()["detail"]

    async def test_create_clue_with_invalid_npc(
        self, client: AsyncClient, script_id: str
    ):
        """Test clue creation with non-existent NPC."""
        response = await client.post(
            "/api/clues",
            json={
                "script_id": script_id,
                "npc_id": "non-existent-id",
                "name": "Test Clue",
                "type": "text",
                "detail": "Test detail",
                "detail_for_npc": "How to reveal this clue",
                "trigger_keywords": [],
                "prereq_clue_ids": [],
            },
        )

        assert response.status_code == 404
        assert "NPC" in response.json()["detail"]

    async def test_create_image_type_clue(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test creating an image type clue."""
        clue_create_data["type"] = "image"
        clue_create_data["name"] = "Crime Scene Photo"
        clue_create_data["detail"] = "http://example.com/photo.jpg"

        response = await client.post("/api/clues", json=clue_create_data)

        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "image"


class TestClueList:
    """Tests for clue listing."""

    async def test_list_clues_empty(self, client: AsyncClient):
        """Test listing clues when none exist."""
        response = await client.get("/api/clues")

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_list_clues_with_data(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test listing clues after creation."""
        # Create multiple clues
        await client.post("/api/clues", json=clue_create_data)
        clue_create_data["name"] = "Another Clue"
        await client.post("/api/clues", json=clue_create_data)

        response = await client.get("/api/clues")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    async def test_list_clues_filter_by_script(
        self, client: AsyncClient, script_id: str, clue_create_data: dict
    ):
        """Test filtering clues by script_id."""
        await client.post("/api/clues", json=clue_create_data)

        response = await client.get(f"/api/clues?script_id={script_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["script_id"] == script_id

    async def test_list_clues_filter_by_npc(
        self, client: AsyncClient, npc_id: str, clue_create_data: dict
    ):
        """Test filtering clues by npc_id."""
        await client.post("/api/clues", json=clue_create_data)

        response = await client.get(f"/api/clues?npc_id={npc_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["npc_id"] == npc_id

    async def test_list_clues_filter_by_type(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test filtering clues by type."""
        # Create text clue
        await client.post("/api/clues", json=clue_create_data)

        # Create image clue
        clue_create_data["name"] = "Photo"
        clue_create_data["type"] = "image"
        await client.post("/api/clues", json=clue_create_data)

        response = await client.get("/api/clues?type=text")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["type"] == "text"

    async def test_list_clues_search_by_name(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test searching clues by name."""
        await client.post("/api/clues", json=clue_create_data)
        clue_create_data["name"] = "Secret Document"
        await client.post("/api/clues", json=clue_create_data)

        response = await client.get("/api/clues?search=Bloody")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Bloody Knife"

    async def test_list_clues_pagination(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test clue listing pagination."""
        # Create 5 clues
        for i in range(5):
            clue_create_data["name"] = f"Clue {i}"
            await client.post("/api/clues", json=clue_create_data)

        # Get first page
        response = await client.get("/api/clues?page=1&page_size=2")
        data = response.json()
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert data["total_pages"] == 3


class TestClueGet:
    """Tests for getting a single clue."""

    async def test_get_clue_success(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test getting a clue by ID."""
        create_response = await client.post("/api/clues", json=clue_create_data)
        clue_id = create_response.json()["id"]

        response = await client.get(f"/api/clues/{clue_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == clue_id
        assert data["name"] == "Bloody Knife"

    async def test_get_clue_not_found(self, client: AsyncClient):
        """Test getting a non-existent clue."""
        response = await client.get("/api/clues/non-existent-id")

        assert response.status_code == 404
        assert "Clue" in response.json()["detail"]


class TestClueUpdate:
    """Tests for clue updates."""

    async def test_update_clue_success(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test updating a clue."""
        create_response = await client.post("/api/clues", json=clue_create_data)
        clue_id = create_response.json()["id"]

        response = await client.put(
            f"/api/clues/{clue_id}",
            json={
                "name": "Updated Knife",
                "detail": "A freshly cleaned knife",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Knife"
        assert data["detail"] == "A freshly cleaned knife"
        # Unchanged fields should remain
        assert data["type"] == "text"

    async def test_update_clue_type(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test updating clue type."""
        create_response = await client.post("/api/clues", json=clue_create_data)
        clue_id = create_response.json()["id"]

        response = await client.put(
            f"/api/clues/{clue_id}",
            json={"type": "image"},
        )

        assert response.status_code == 200
        assert response.json()["type"] == "image"

    async def test_update_clue_trigger_keywords(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test updating clue trigger keywords."""
        create_response = await client.post("/api/clues", json=clue_create_data)
        clue_id = create_response.json()["id"]

        new_keywords = ["new", "keywords"]
        response = await client.put(
            f"/api/clues/{clue_id}",
            json={"trigger_keywords": new_keywords},
        )

        assert response.status_code == 200
        assert response.json()["trigger_keywords"] == new_keywords

    async def test_update_clue_not_found(self, client: AsyncClient):
        """Test updating a non-existent clue."""
        response = await client.put(
            "/api/clues/non-existent-id",
            json={"name": "New Name"},
        )

        assert response.status_code == 404


class TestClueDelete:
    """Tests for clue deletion."""

    async def test_delete_clue_success(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test deleting a clue."""
        create_response = await client.post("/api/clues", json=clue_create_data)
        clue_id = create_response.json()["id"]

        response = await client.delete(f"/api/clues/{clue_id}")
        assert response.status_code == 204

        # Verify clue is deleted
        get_response = await client.get(f"/api/clues/{clue_id}")
        assert get_response.status_code == 404

    async def test_delete_clue_not_found(self, client: AsyncClient):
        """Test deleting a non-existent clue."""
        response = await client.delete("/api/clues/non-existent-id")
        assert response.status_code == 404


class TestClueDependencies:
    """Tests for clue dependency management."""

    async def test_update_dependencies_success(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test updating clue dependencies."""
        # Create prerequisite clue
        clue_create_data["name"] = "Prerequisite Clue"
        prereq_response = await client.post("/api/clues", json=clue_create_data)
        prereq_id = prereq_response.json()["id"]

        # Create dependent clue
        clue_create_data["name"] = "Dependent Clue"
        clue_create_data["prereq_clue_ids"] = []
        dep_response = await client.post("/api/clues", json=clue_create_data)
        dep_id = dep_response.json()["id"]

        # Update dependencies
        response = await client.put(
            f"/api/clues/{dep_id}/dependencies",
            json={"prereq_clue_ids": [prereq_id]},
        )

        assert response.status_code == 200
        data = response.json()
        assert prereq_id in data["prereq_clue_ids"]

    async def test_prevent_self_dependency(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test that a clue cannot depend on itself."""
        create_response = await client.post("/api/clues", json=clue_create_data)
        clue_id = create_response.json()["id"]

        response = await client.put(
            f"/api/clues/{clue_id}/dependencies",
            json={"prereq_clue_ids": [clue_id]},
        )

        assert response.status_code == 400
        assert "itself" in response.json()["detail"].lower()

    async def test_prevent_circular_dependency(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test that circular dependencies are prevented."""
        # Create clue A
        clue_create_data["name"] = "Clue A"
        resp_a = await client.post("/api/clues", json=clue_create_data)
        id_a = resp_a.json()["id"]

        # Create clue B that depends on A
        clue_create_data["name"] = "Clue B"
        clue_create_data["prereq_clue_ids"] = [id_a]
        resp_b = await client.post("/api/clues", json=clue_create_data)
        id_b = resp_b.json()["id"]

        # Create clue C that depends on B
        clue_create_data["name"] = "Clue C"
        clue_create_data["prereq_clue_ids"] = [id_b]
        resp_c = await client.post("/api/clues", json=clue_create_data)
        id_c = resp_c.json()["id"]

        # Try to make A depend on C (creates cycle: A -> B -> C -> A)
        response = await client.put(
            f"/api/clues/{id_a}/dependencies",
            json={"prereq_clue_ids": [id_c]},
        )

        assert response.status_code == 400
        assert "circular" in response.json()["detail"].lower()

    async def test_dependency_with_nonexistent_clue(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test adding a dependency on a non-existent clue."""
        create_response = await client.post("/api/clues", json=clue_create_data)
        clue_id = create_response.json()["id"]

        response = await client.put(
            f"/api/clues/{clue_id}/dependencies",
            json={"prereq_clue_ids": ["non-existent-id"]},
        )

        assert response.status_code == 404

    async def test_remove_all_dependencies(
        self, client: AsyncClient, clue_create_data: dict
    ):
        """Test removing all dependencies from a clue."""
        # Create prerequisite clue
        clue_create_data["name"] = "Prerequisite"
        prereq_response = await client.post("/api/clues", json=clue_create_data)
        prereq_id = prereq_response.json()["id"]

        # Create clue with dependency
        clue_create_data["name"] = "With Dependency"
        clue_create_data["prereq_clue_ids"] = [prereq_id]
        dep_response = await client.post("/api/clues", json=clue_create_data)
        dep_id = dep_response.json()["id"]

        # Remove all dependencies
        response = await client.put(
            f"/api/clues/{dep_id}/dependencies",
            json={"prereq_clue_ids": []},
        )

        assert response.status_code == 200
        assert response.json()["prereq_clue_ids"] == []


class TestClueTree:
    """Tests for clue tree endpoints."""

    async def test_get_clue_tree_empty(
        self, client: AsyncClient, script_id: str
    ):
        """Test getting clue tree when no clues exist."""
        response = await client.get(f"/api/scripts/{script_id}/clue-tree")

        assert response.status_code == 200
        data = response.json()
        assert data["nodes"] == []
        assert data["edges"] == []

    async def test_get_clue_tree_with_clues(
        self, client: AsyncClient, script_id: str, clue_create_data: dict
    ):
        """Test getting clue tree with clues."""
        # Create clue
        await client.post("/api/clues", json=clue_create_data)

        response = await client.get(f"/api/scripts/{script_id}/clue-tree")

        assert response.status_code == 200
        data = response.json()
        assert len(data["nodes"]) == 1
        assert data["nodes"][0]["name"] == "Bloody Knife"

    async def test_get_clue_tree_with_edges(
        self, client: AsyncClient, script_id: str, clue_create_data: dict
    ):
        """Test getting clue tree with dependencies (edges)."""
        # Create prerequisite clue
        clue_create_data["name"] = "First Clue"
        resp1 = await client.post("/api/clues", json=clue_create_data)
        id1 = resp1.json()["id"]

        # Create dependent clue
        clue_create_data["name"] = "Second Clue"
        clue_create_data["prereq_clue_ids"] = [id1]
        await client.post("/api/clues", json=clue_create_data)

        response = await client.get(f"/api/scripts/{script_id}/clue-tree")

        assert response.status_code == 200
        data = response.json()
        assert len(data["nodes"]) == 2
        assert len(data["edges"]) == 1
        assert data["edges"][0]["source"] == id1

    async def test_get_clue_tree_not_found(self, client: AsyncClient):
        """Test getting clue tree for non-existent script."""
        response = await client.get("/api/scripts/non-existent-id/clue-tree")

        assert response.status_code == 404

    async def test_get_clue_tree_issues(
        self, client: AsyncClient, script_id: str, clue_create_data: dict
    ):
        """Test that clue tree includes validation issues."""
        # Create a single clue (potential orphan in some validation scenarios)
        await client.post("/api/clues", json=clue_create_data)

        response = await client.get(f"/api/scripts/{script_id}/clue-tree")

        assert response.status_code == 200
        data = response.json()
        assert "issues" in data
        assert "dead_clues" in data["issues"]
        assert "orphan_clues" in data["issues"]
        assert "cycles" in data["issues"]
