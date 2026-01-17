"""LiteLLM client wrapper for unified LLM access.

All LLM calls go through LiteLLM with logical model aliases:
- chat-default: Balanced cost/performance (GPT-4.1)
- chat-fast: Economy model (GPT-4.1-mini)
- chat-premium: High-quality reasoning (GPT-4.1 with fallbacks)
- vision-default: Vision model (GPT-4o)
- embed-default: OpenAI embeddings
- embed-local: Local TEI server
"""

from functools import lru_cache

import litellm
from litellm import Router

from app.config import get_settings


class LLMClient:
    """Unified LLM client using LiteLLM.
    
    Provides async methods for:
    - acompletion: Chat completions
    - aembedding: Text embeddings
    """

    def __init__(self) -> None:
        settings = get_settings()
        
        # Configure LiteLLM
        litellm.drop_params = True
        litellm.set_verbose = settings.debug
        
        # Set API base URL if using LiteLLM proxy
        if settings.litellm_base_url:
            self.base_url = settings.litellm_base_url
            self.api_key = settings.litellm_api_key or "sk-placeholder"
        else:
            self.base_url = None
            self.api_key = None

    async def acompletion(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        timeout: int = 120,
        **kwargs,
    ):
        """Async chat completion via LiteLLM.
        
        Args:
            model: Model alias (e.g., "chat-default") or full model name
            messages: List of message dicts with role and content
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens in response
            timeout: Request timeout in seconds
            **kwargs: Additional LiteLLM parameters
            
        Returns:
            LiteLLM response object with choices[0].message.content
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
            
        # If using LiteLLM proxy, set base URL
        if self.base_url:
            params["api_base"] = self.base_url
            params["api_key"] = self.api_key
            
        return await litellm.acompletion(**params)

    async def aembedding(
        self,
        model: str,
        input: list[str] | str,
        timeout: int = 60,
        **kwargs,
    ):
        """Async text embedding via LiteLLM.
        
        Args:
            model: Model alias (e.g., "embed-default") or full model name
            input: Text or list of texts to embed
            timeout: Request timeout in seconds
            **kwargs: Additional LiteLLM parameters
            
        Returns:
            LiteLLM response object with data[].embedding
        """
        params = {
            "model": model,
            "input": input if isinstance(input, list) else [input],
            "timeout": timeout,
            **kwargs,
        }
        
        # If using LiteLLM proxy, set base URL
        if self.base_url:
            params["api_base"] = self.base_url
            params["api_key"] = self.api_key
            
        return await litellm.aembedding(**params)


@lru_cache
def get_llm_client() -> LLMClient:
    """Get cached LLM client instance.
    
    Returns:
        LLMClient configured with settings from environment
    """
    return LLMClient()
