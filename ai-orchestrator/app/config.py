from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development", alias="APP_ENV")
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    debug: bool = Field(default=False, alias="DEBUG")

    ai_server_url: str = Field(default="https://api.openai.com/v1", alias="AI_SERVER_URL")
    openai_api_base_url: str | None = Field(default=None, alias="OPENAI_API_BASE_URL")
    ai_api_key: str = Field(default="", alias="AI_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")

    default_chat_model: str = Field(default="gpt-4.1", alias="DEFAULT_CHAT_MODEL")
    default_vision_model: str = Field(default="gpt-4o", alias="DEFAULT_VISION_MODEL")
    default_embed_model: str = Field(default="text-embedding-3-small", alias="AI_EMBED_MODEL")

    redis_url: str = Field(default="redis://redis:6379", alias="REDIS_URL")
    redis_password: str = Field(default="", alias="REDIS_PASSWORD")

    chroma_url: str = Field(default="http://chromadb:8000", alias="CHROMA_URL")
    chroma_collection: str = Field(default="blog-posts", alias="CHROMA_COLLECTION")

    embedding_base_url: str = Field(default="", alias="AI_EMBEDDING_URL")
    embedding_api_key: str = Field(default="", alias="AI_EMBEDDING_API_KEY")

    postgres_url: str = Field(default="", alias="DATABASE_URL")

    backend_api_url: str = Field(default="http://api:5080", alias="BACKEND_API_URL")
    backend_api_key: str = Field(default="", alias="BACKEND_API_KEY")

    request_timeout: int = Field(default=120, alias="REQUEST_TIMEOUT")
    max_tokens_default: int = Field(default=4096, alias="MAX_TOKENS_DEFAULT")

    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_format: str = Field(default="json", alias="LOG_FORMAT")

    cors_origins: list[str] = Field(
        default=["https://noblog.nodove.com", "https://api.nodove.com"],
        alias="CORS_ORIGINS",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
