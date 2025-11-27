"""Tests for Prompt Template API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.fixture
def template_create_data() -> dict:
    """Sample template creation data."""
    return {
        "name": "Test Template",
        "description": "A template for testing",
        "type": "clue_embedding",
        "content": "Clue: {clue.name}\nDetail: {clue.detail}",
        "is_default": False,
    }


class TestTemplateCreate:
    """Tests for template creation."""

    async def test_create_template_success(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test successful template creation."""
        response = await client.post("/api/templates", json=template_create_data)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Template"
        assert data["type"] == "clue_embedding"
        assert data["content"] == template_create_data["content"]
        assert data["is_default"] is False
        assert "id" in data
        assert "created_at" in data
        # Variables should be extracted from content
        assert "clue.name" in data["variables"]
        assert "clue.detail" in data["variables"]

    async def test_create_template_as_default(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test creating a template as default."""
        template_create_data["is_default"] = True
        response = await client.post("/api/templates", json=template_create_data)

        assert response.status_code == 201
        data = response.json()
        assert data["is_default"] is True

    async def test_create_template_replaces_default(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test that creating a new default unsets the old default."""
        # Create first default template
        template_create_data["is_default"] = True
        template_create_data["name"] = "First Default"
        response1 = await client.post("/api/templates", json=template_create_data)
        first_id = response1.json()["id"]

        # Create second default template of same type
        template_create_data["name"] = "Second Default"
        response2 = await client.post("/api/templates", json=template_create_data)
        second_id = response2.json()["id"]

        # First should no longer be default
        get_first = await client.get(f"/api/templates/{first_id}")
        assert get_first.json()["is_default"] is False

        # Second should be default
        get_second = await client.get(f"/api/templates/{second_id}")
        assert get_second.json()["is_default"] is True

    async def test_create_template_different_types(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test creating templates of different types."""
        # Create clue_embedding template
        template_create_data["type"] = "clue_embedding"
        response1 = await client.post("/api/templates", json=template_create_data)
        assert response1.status_code == 201

        # Create npc_system_prompt template
        template_create_data["type"] = "npc_system_prompt"
        template_create_data["name"] = "NPC System Prompt Template"
        response2 = await client.post("/api/templates", json=template_create_data)
        assert response2.status_code == 201
        assert response2.json()["type"] == "npc_system_prompt"


class TestTemplateList:
    """Tests for template listing."""

    async def test_list_templates_empty(self, client: AsyncClient):
        """Test listing templates when none exist."""
        response = await client.get("/api/templates")

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_list_templates_with_data(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test listing templates after creation."""
        # Create multiple templates
        await client.post("/api/templates", json=template_create_data)
        template_create_data["name"] = "Another Template"
        await client.post("/api/templates", json=template_create_data)

        response = await client.get("/api/templates")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    async def test_list_templates_filter_by_type(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test filtering templates by type."""
        # Create template of type clue_embedding
        template_create_data["type"] = "clue_embedding"
        await client.post("/api/templates", json=template_create_data)

        # Create template of type npc_response
        template_create_data["type"] = "npc_response"
        template_create_data["name"] = "NPC Template"
        await client.post("/api/templates", json=template_create_data)

        response = await client.get("/api/templates?type=clue_embedding")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["type"] == "clue_embedding"

    async def test_list_templates_search(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test searching templates by name."""
        template_create_data["name"] = "Unique Name Template"
        await client.post("/api/templates", json=template_create_data)

        template_create_data["name"] = "Another Template"
        await client.post("/api/templates", json=template_create_data)

        response = await client.get("/api/templates?search=Unique")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert "Unique" in data["items"][0]["name"]

    async def test_list_templates_pagination(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test template listing pagination."""
        # Create 5 templates
        for i in range(5):
            template_create_data["name"] = f"Template {i}"
            await client.post("/api/templates", json=template_create_data)

        response = await client.get("/api/templates?page=1&page_size=2")
        data = response.json()
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert data["page"] == 1


class TestTemplateGet:
    """Tests for getting a single template."""

    async def test_get_template_success(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test getting a template by ID."""
        create_response = await client.post("/api/templates", json=template_create_data)
        template_id = create_response.json()["id"]

        response = await client.get(f"/api/templates/{template_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == template_id
        assert data["name"] == "Test Template"

    async def test_get_template_not_found(self, client: AsyncClient):
        """Test getting a non-existent template."""
        response = await client.get("/api/templates/non-existent-id")

        assert response.status_code == 404


class TestTemplateUpdate:
    """Tests for template updates."""

    async def test_update_template_success(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test updating a template."""
        create_response = await client.post("/api/templates", json=template_create_data)
        template_id = create_response.json()["id"]

        response = await client.put(
            f"/api/templates/{template_id}",
            json={
                "name": "Updated Name",
                "content": "New content: {npc.name}",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["content"] == "New content: {npc.name}"
        # Variables should be updated
        assert "npc.name" in data["variables"]

    async def test_update_template_set_default(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test setting a template as default via update."""
        # Create two templates
        template_create_data["name"] = "Template 1"
        template_create_data["is_default"] = True
        resp1 = await client.post("/api/templates", json=template_create_data)
        id1 = resp1.json()["id"]

        template_create_data["name"] = "Template 2"
        template_create_data["is_default"] = False
        resp2 = await client.post("/api/templates", json=template_create_data)
        id2 = resp2.json()["id"]

        # Update second template to be default
        await client.put(f"/api/templates/{id2}", json={"is_default": True})

        # Check first is no longer default
        get1 = await client.get(f"/api/templates/{id1}")
        assert get1.json()["is_default"] is False

        # Check second is now default
        get2 = await client.get(f"/api/templates/{id2}")
        assert get2.json()["is_default"] is True

    async def test_update_template_not_found(self, client: AsyncClient):
        """Test updating a non-existent template."""
        response = await client.put(
            "/api/templates/non-existent-id",
            json={"name": "New Name"},
        )

        assert response.status_code == 404


class TestTemplateDelete:
    """Tests for template deletion (soft delete)."""

    async def test_delete_template_success(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test soft deleting a template."""
        create_response = await client.post("/api/templates", json=template_create_data)
        template_id = create_response.json()["id"]

        response = await client.delete(f"/api/templates/{template_id}")
        assert response.status_code == 204

        # Verify template is soft deleted (not found via normal query)
        get_response = await client.get(f"/api/templates/{template_id}")
        assert get_response.status_code == 404

    async def test_delete_template_not_found(self, client: AsyncClient):
        """Test deleting a non-existent template."""
        response = await client.delete("/api/templates/non-existent-id")
        assert response.status_code == 404


class TestTemplateDuplicate:
    """Tests for template duplication."""

    async def test_duplicate_template_success(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test duplicating a template."""
        create_response = await client.post("/api/templates", json=template_create_data)
        original_id = create_response.json()["id"]

        response = await client.post(f"/api/templates/{original_id}/duplicate")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] != original_id
        assert data["name"] == "Test Template (Copy)"
        assert data["content"] == template_create_data["content"]
        assert data["is_default"] is False  # Duplicate should not be default

    async def test_duplicate_default_template(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test duplicating a default template doesn't create another default."""
        template_create_data["is_default"] = True
        create_response = await client.post("/api/templates", json=template_create_data)
        original_id = create_response.json()["id"]

        response = await client.post(f"/api/templates/{original_id}/duplicate")

        assert response.status_code == 200
        assert response.json()["is_default"] is False

    async def test_duplicate_template_not_found(self, client: AsyncClient):
        """Test duplicating a non-existent template."""
        response = await client.post("/api/templates/non-existent-id/duplicate")
        assert response.status_code == 404


class TestTemplateSetDefault:
    """Tests for setting a template as default."""

    async def test_set_default_success(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test setting a template as default."""
        create_response = await client.post("/api/templates", json=template_create_data)
        template_id = create_response.json()["id"]

        response = await client.post(f"/api/templates/{template_id}/set-default")

        assert response.status_code == 200
        assert response.json()["is_default"] is True

    async def test_set_default_unsets_previous(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test that setting default unsets the previous default."""
        # Create first template as default
        template_create_data["is_default"] = True
        resp1 = await client.post("/api/templates", json=template_create_data)
        id1 = resp1.json()["id"]

        # Create second template (not default)
        template_create_data["name"] = "Second Template"
        template_create_data["is_default"] = False
        resp2 = await client.post("/api/templates", json=template_create_data)
        id2 = resp2.json()["id"]

        # Set second as default
        await client.post(f"/api/templates/{id2}/set-default")

        # Check first is no longer default
        get1 = await client.get(f"/api/templates/{id1}")
        assert get1.json()["is_default"] is False

    async def test_set_default_not_found(self, client: AsyncClient):
        """Test setting default for non-existent template."""
        response = await client.post("/api/templates/non-existent-id/set-default")
        assert response.status_code == 404


class TestTemplateDefaults:
    """Tests for getting default templates."""

    async def test_get_defaults_empty(self, client: AsyncClient):
        """Test getting defaults when none exist."""
        response = await client.get("/api/templates/defaults")

        assert response.status_code == 200
        data = response.json()
        # All types should be None
        for value in data.values():
            assert value is None

    async def test_get_defaults_with_data(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test getting defaults after setting some."""
        # Create default template of type clue_embedding
        template_create_data["is_default"] = True
        template_create_data["type"] = "clue_embedding"
        await client.post("/api/templates", json=template_create_data)

        response = await client.get("/api/templates/defaults")

        assert response.status_code == 200
        data = response.json()
        assert data["clue_embedding"] is not None
        assert data["clue_embedding"]["type"] == "clue_embedding"


class TestTemplateVariables:
    """Tests for available template variables."""

    async def test_get_available_variables(self, client: AsyncClient):
        """Test getting available template variables."""
        response = await client.get("/api/templates/variables")

        assert response.status_code == 200
        data = response.json()
        # Should have categories like clue, npc, script
        assert "categories" in data


class TestTemplateRender:
    """Tests for template rendering."""

    async def test_render_with_content(self, client: AsyncClient):
        """Test rendering template with provided content."""
        response = await client.post(
            "/api/templates/render",
            json={
                "template_content": "Hello {name}, you are {age} years old.",
                "context": {"name": "John", "age": 30},
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["rendered_content"] == "Hello John, you are 30 years old."

    async def test_render_with_template_id(
        self, client: AsyncClient, template_create_data: dict
    ):
        """Test rendering using template ID."""
        # Create a template
        template_create_data["content"] = "Clue name: {clue.name}"
        create_response = await client.post("/api/templates", json=template_create_data)
        template_id = create_response.json()["id"]

        response = await client.post(
            "/api/templates/render",
            json={
                "template_id": template_id,
                "context": {"clue": {"name": "Murder Weapon"}},
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["rendered_content"] == "Clue name: Murder Weapon"

    async def test_render_missing_content(self, client: AsyncClient):
        """Test rendering without content or template_id."""
        response = await client.post(
            "/api/templates/render",
            json={"context": {}},
        )

        assert response.status_code == 400

    async def test_render_template_not_found(self, client: AsyncClient):
        """Test rendering with non-existent template ID."""
        response = await client.post(
            "/api/templates/render",
            json={
                "template_id": "non-existent-id",
                "context": {},
            },
        )

        assert response.status_code == 404
