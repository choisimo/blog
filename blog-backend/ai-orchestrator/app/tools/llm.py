"""OpenAI-compatible client wrapper for unified LLM access.

All LLM calls go through an OpenAI-compatible endpoint with default models
configured via DEFAULT_CHAT_MODEL, DEFAULT_VISION_MODEL, and AI_EMBED_MODEL.
"""

from functools import lru_cache

from openai import AsyncOpenAI

from app.config import get_settings


class LLMClient:
    """Unified LLM client using an OpenAI-compatible API.

    Provides async methods for:
    - acompletion: Chat completions
    - aembedding: Text embeddings
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.openai_api_base_url or settings.ai_server_url
        self.api_key = settings.ai_api_key or settings.openai_api_key or "sk-placeholder"
        self.embedding_base_url = settings.embedding_base_url or self.base_url
        self.embedding_api_key = settings.embedding_api_key or self.api_key

        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
        )
        self.embedding_client = AsyncOpenAI(
            api_key=self.embedding_api_key,
            base_url=self.embedding_base_url,
        )

    async def acompletion(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        timeout: int = 120,
        **kwargs,
    ):
        """Async chat completion via OpenAI-compatible endpoint.

        Args:
            model: Model name
            messages: List of message dicts with role and content
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens in response
            timeout: Request timeout in seconds
            **kwargs: Additional OpenAI parameters

        Returns:
            OpenAI response object with choices[0].message.content
        """
        params = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "timeout": timeout,
            **kwargs,
        }
        
        if max_tokens:
            params["max_tokens"] = max_tokens
            
        return await self.client.chat.completions.create(**params)

    async def aembedding(
        self,
        model: str,
        input: list[str] | str,
        timeout: int = 60,
        **kwargs,
    ):
        """Async text embedding via OpenAI-compatible endpoint.

        Args:
            model: Model name
            input: Text or list of texts to embed
            timeout: Request timeout in seconds
            **kwargs: Additional OpenAI parameters

        Returns:
            OpenAI response object with data[].embedding
        """
        params = {
            "model": model,
            "input": input if isinstance(input, list) else [input],
            "timeout": timeout,
            **kwargs,
        }
        
        return await self.embedding_client.embeddings.create(**params)


@lru_cache
def get_llm_client() -> LLMClient:
    """Get cached LLM client instance.
    
    Returns:
        LLMClient configured with settings from environment
    """
    return LLMClient()
