"""Application configuration settings."""

import os
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


def get_env_file() -> str:
    """
    根据 ENV_FILE 环境变量或 ENVIRONMENT 决定加载哪个配置文件。

    优先级：
    1. ENV_FILE 环境变量（如果设置）
    2. ENVIRONMENT=production -> .env.production (如果存在) -> .env
    3. 默认 -> .env.local (如果存在) -> .env
    """
    # 显式指定的环境文件
    env_file = os.getenv("ENV_FILE")
    if env_file:
        return env_file

    environment = os.getenv("ENVIRONMENT", "development")

    if environment == "production":
        if os.path.exists(".env.production"):
            return ".env.production"
        return ".env"
    else:
        # development / staging
        if os.path.exists(".env.local"):
            return ".env.local"
        return ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=get_env_file(),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore extra env vars like VITE_*
    )

    # Application
    app_name: str = "LARP Admin API"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: Literal["development", "staging", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/larp_admin"
    database_echo: bool = False

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = ["*"]
    cors_allow_headers: list[str] = ["*"]

    # Pagination
    default_page_size: int = 20
    max_page_size: int = 500

    # LLM Timeout (seconds)
    llm_timeout: float = 60.0  # Default timeout for LLM calls
    llm_long_timeout: float = 120.0  # Timeout for long LLM calls (chat, JSON response)
    llm_stream_timeout: float = 300.0  # Timeout for streaming LLM calls

    # LLM Temperature settings
    llm_default_temperature: float = 0.7  # Default temperature for LLM calls
    llm_matching_temperature: float = 0.1  # Temperature for matching/analysis tasks

    # Dialogue settings
    dialogue_history_limit: int = 4  # Max dialogue history entries to include

    # JWT Authentication
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()


settings = get_settings()
