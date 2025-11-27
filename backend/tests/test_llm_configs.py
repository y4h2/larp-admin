"""Tests for LLM Configuration API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.fixture
def llm_config_create_data() -> dict:
    """Sample LLM config creation data."""
    return {
        "name": "Test Embedding Config",
        "type": "embedding",
        "model": "text-embedding-3-small",
        "base_url": "https://api.openai.com/v1",
        "api_key": "sk-test-key-12345",
        "is_default": False,
        "options": {
            "threshold": 0.7,
            "dimensions": 1536,
        },
    }


class TestLLMConfigCreate:
    """Tests for LLM config creation."""

    async def test_create_config_success(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test successful LLM config creation."""
        response = await client.post("/api/llm-configs", json=llm_config_create_data)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Embedding Config"
        assert data["type"] == "embedding"
        assert data["model"] == "text-embedding-3-small"
        assert data["is_default"] is False
        assert "id" in data
        # API key should be masked in response
        assert "****" in data["api_key_masked"]
        assert data["api_key_masked"].startswith("sk-t")

    async def test_create_config_as_default(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test creating a config as default."""
        llm_config_create_data["is_default"] = True
        response = await client.post("/api/llm-configs", json=llm_config_create_data)

        assert response.status_code == 201
        data = response.json()
        assert data["is_default"] is True

    async def test_create_config_replaces_default(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test that creating a new default unsets the old default."""
        # Create first default config
        llm_config_create_data["is_default"] = True
        llm_config_create_data["name"] = "First Default"
        response1 = await client.post("/api/llm-configs", json=llm_config_create_data)
        first_id = response1.json()["id"]

        # Create second default config of same type
        llm_config_create_data["name"] = "Second Default"
        response2 = await client.post("/api/llm-configs", json=llm_config_create_data)
        second_id = response2.json()["id"]

        # First should no longer be default
        get_first = await client.get(f"/api/llm-configs/{first_id}")
        assert get_first.json()["is_default"] is False

        # Second should be default
        get_second = await client.get(f"/api/llm-configs/{second_id}")
        assert get_second.json()["is_default"] is True

    async def test_create_chat_config(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test creating a chat type config."""
        llm_config_create_data["type"] = "chat"
        llm_config_create_data["model"] = "gpt-4"
        llm_config_create_data["name"] = "Chat Config"
        llm_config_create_data["options"] = {
            "temperature": 0.7,
            "max_tokens": 1000,
        }

        response = await client.post("/api/llm-configs", json=llm_config_create_data)

        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "chat"
        assert data["model"] == "gpt-4"
        assert data["options"]["temperature"] == 0.7


class TestLLMConfigList:
    """Tests for LLM config listing."""

    async def test_list_configs_empty(self, client: AsyncClient):
        """Test listing configs when none exist."""
        response = await client.get("/api/llm-configs")

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_list_configs_with_data(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test listing configs after creation."""
        # Create multiple configs
        await client.post("/api/llm-configs", json=llm_config_create_data)
        llm_config_create_data["name"] = "Another Config"
        await client.post("/api/llm-configs", json=llm_config_create_data)

        response = await client.get("/api/llm-configs")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    async def test_list_configs_filter_by_type(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test filtering configs by type."""
        # Create embedding config
        llm_config_create_data["type"] = "embedding"
        await client.post("/api/llm-configs", json=llm_config_create_data)

        # Create chat config
        llm_config_create_data["type"] = "chat"
        llm_config_create_data["name"] = "Chat Config"
        await client.post("/api/llm-configs", json=llm_config_create_data)

        response = await client.get("/api/llm-configs?type=embedding")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["type"] == "embedding"

    async def test_list_configs_search(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test searching configs by name."""
        llm_config_create_data["name"] = "Unique OpenAI Config"
        await client.post("/api/llm-configs", json=llm_config_create_data)

        llm_config_create_data["name"] = "Another Config"
        await client.post("/api/llm-configs", json=llm_config_create_data)

        response = await client.get("/api/llm-configs?search=OpenAI")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert "OpenAI" in data["items"][0]["name"]

    async def test_list_configs_pagination(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test config listing pagination."""
        # Create 5 configs
        for i in range(5):
            llm_config_create_data["name"] = f"Config {i}"
            await client.post("/api/llm-configs", json=llm_config_create_data)

        response = await client.get("/api/llm-configs?page=1&page_size=2")
        data = response.json()
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert data["page"] == 1


class TestLLMConfigGet:
    """Tests for getting a single LLM config."""

    async def test_get_config_success(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test getting a config by ID."""
        create_response = await client.post("/api/llm-configs", json=llm_config_create_data)
        config_id = create_response.json()["id"]

        response = await client.get(f"/api/llm-configs/{config_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == config_id
        assert data["name"] == "Test Embedding Config"

    async def test_get_config_not_found(self, client: AsyncClient):
        """Test getting a non-existent config."""
        response = await client.get("/api/llm-configs/non-existent-id")

        assert response.status_code == 404


class TestLLMConfigUpdate:
    """Tests for LLM config updates."""

    async def test_update_config_success(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test updating a config."""
        create_response = await client.post("/api/llm-configs", json=llm_config_create_data)
        config_id = create_response.json()["id"]

        response = await client.put(
            f"/api/llm-configs/{config_id}",
            json={
                "name": "Updated Name",
                "model": "text-embedding-3-large",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["model"] == "text-embedding-3-large"

    async def test_update_config_set_default(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test setting a config as default via update."""
        # Create two configs
        llm_config_create_data["name"] = "Config 1"
        llm_config_create_data["is_default"] = True
        resp1 = await client.post("/api/llm-configs", json=llm_config_create_data)
        id1 = resp1.json()["id"]

        llm_config_create_data["name"] = "Config 2"
        llm_config_create_data["is_default"] = False
        resp2 = await client.post("/api/llm-configs", json=llm_config_create_data)
        id2 = resp2.json()["id"]

        # Update second config to be default
        await client.put(f"/api/llm-configs/{id2}", json={"is_default": True})

        # Check first is no longer default
        get1 = await client.get(f"/api/llm-configs/{id1}")
        assert get1.json()["is_default"] is False

        # Check second is now default
        get2 = await client.get(f"/api/llm-configs/{id2}")
        assert get2.json()["is_default"] is True

    async def test_update_config_options(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test updating config options."""
        create_response = await client.post("/api/llm-configs", json=llm_config_create_data)
        config_id = create_response.json()["id"]

        new_options = {"threshold": 0.9, "new_setting": "value"}
        response = await client.put(
            f"/api/llm-configs/{config_id}",
            json={"options": new_options},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["options"]["threshold"] == 0.9
        assert data["options"]["new_setting"] == "value"

    async def test_update_config_not_found(self, client: AsyncClient):
        """Test updating a non-existent config."""
        response = await client.put(
            "/api/llm-configs/non-existent-id",
            json={"name": "New Name"},
        )

        assert response.status_code == 404


class TestLLMConfigDelete:
    """Tests for LLM config deletion (soft delete)."""

    async def test_delete_config_success(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test soft deleting a config."""
        create_response = await client.post("/api/llm-configs", json=llm_config_create_data)
        config_id = create_response.json()["id"]

        response = await client.delete(f"/api/llm-configs/{config_id}")
        assert response.status_code == 204

        # Verify config is soft deleted (not found via normal query)
        get_response = await client.get(f"/api/llm-configs/{config_id}")
        assert get_response.status_code == 404

    async def test_delete_config_not_found(self, client: AsyncClient):
        """Test deleting a non-existent config."""
        response = await client.delete("/api/llm-configs/non-existent-id")
        assert response.status_code == 404


class TestLLMConfigSetDefault:
    """Tests for setting a config as default."""

    async def test_set_default_success(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test setting a config as default."""
        create_response = await client.post("/api/llm-configs", json=llm_config_create_data)
        config_id = create_response.json()["id"]

        response = await client.post(f"/api/llm-configs/{config_id}/set-default")

        assert response.status_code == 200
        assert response.json()["is_default"] is True

    async def test_set_default_unsets_previous(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test that setting default unsets the previous default."""
        # Create first config as default
        llm_config_create_data["is_default"] = True
        resp1 = await client.post("/api/llm-configs", json=llm_config_create_data)
        id1 = resp1.json()["id"]

        # Create second config (not default)
        llm_config_create_data["name"] = "Second Config"
        llm_config_create_data["is_default"] = False
        resp2 = await client.post("/api/llm-configs", json=llm_config_create_data)
        id2 = resp2.json()["id"]

        # Set second as default
        await client.post(f"/api/llm-configs/{id2}/set-default")

        # Check first is no longer default
        get1 = await client.get(f"/api/llm-configs/{id1}")
        assert get1.json()["is_default"] is False

    async def test_set_default_not_found(self, client: AsyncClient):
        """Test setting default for non-existent config."""
        response = await client.post("/api/llm-configs/non-existent-id/set-default")
        assert response.status_code == 404


class TestLLMConfigDefaults:
    """Tests for getting default configs."""

    async def test_get_defaults_empty(self, client: AsyncClient):
        """Test getting defaults when none exist."""
        response = await client.get("/api/llm-configs/defaults")

        assert response.status_code == 200
        data = response.json()
        # All types should be None
        assert data["embedding"] is None
        assert data["chat"] is None

    async def test_get_defaults_with_data(
        self, client: AsyncClient, llm_config_create_data: dict
    ):
        """Test getting defaults after setting some."""
        # Create default embedding config
        llm_config_create_data["is_default"] = True
        llm_config_create_data["type"] = "embedding"
        await client.post("/api/llm-configs", json=llm_config_create_data)

        # Create default chat config
        llm_config_create_data["name"] = "Chat Config"
        llm_config_create_data["type"] = "chat"
        llm_config_create_data["model"] = "gpt-4"
        await client.post("/api/llm-configs", json=llm_config_create_data)

        response = await client.get("/api/llm-configs/defaults")

        assert response.status_code == 200
        data = response.json()
        assert data["embedding"] is not None
        assert data["embedding"]["type"] == "embedding"
        assert data["chat"] is not None
        assert data["chat"]["type"] == "chat"
