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

    litellm_base_url: str = Field(default="http://litellm:4000", alias="LITELLM_BASE_URL")
    litellm_api_key: str = Field(default="", alias="LITELLM_API_KEY")
    litellm_master_key: str = Field(default="", alias="LITELLM_MASTER_KEY")

    default_chat_model: str = Field(default="chat-default", alias="DEFAULT_CHAT_MODEL")
    default_vision_model: str = Field(default="vision-default", alias="DEFAULT_VISION_MODEL")
    default_embed_model: str = Field(default="embed-default", alias="DEFAULT_EMBED_MODEL")

    redis_url: str = Field(default="redis://redis:6379", alias="REDIS_URL")
    redis_password: str = Field(default="", alias="REDIS_PASSWORD")

    chroma_url: str = Field(default="http://chromadb:8000", alias="CHROMA_URL")
    chroma_collection: str = Field(default="blog-posts", alias="CHROMA_COLLECTION")

    tei_url: str = Field(default="http://embedding-server:80", alias="TEI_URL")

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
