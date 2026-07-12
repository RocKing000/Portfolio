from __future__ import annotations

import os
from typing import Any

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from .base import BaseLLMProvider, LLMRequest, LLMResponse, ModelTier
from .providers import AnthropicProvider, OpenAIProvider, GoogleProvider, MistralProvider


_PROVIDER_MAP: dict[str, type[BaseLLMProvider]] = {
    "anthropic": AnthropicProvider,
    "openai":    OpenAIProvider,
    "google":    GoogleProvider,
    "mistral":   MistralProvider,
}


class LLMGateway:
    """
    Single entry point for all LLM calls across the SDLC suite.

    Responsibilities:
    - Provider selection (client-configured or env default)
    - Model tier mapping
    - Retry with exponential backoff on transient failures
    - Response validation
    - Usage tracking hook
    """

    def __init__(
        self,
        provider: str | None = None,
        usage_callback=None,
    ):
        provider_name = (provider or os.getenv("LLM_DEFAULT_PROVIDER", "anthropic")).lower()

        if provider_name not in _PROVIDER_MAP:
            raise ValueError(
                f"Unknown LLM provider '{provider_name}'. "
                f"Valid options: {list(_PROVIDER_MAP.keys())}"
            )

        config = self._build_config(provider_name)
        self._provider: BaseLLMProvider = _PROVIDER_MAP[provider_name](config)
        self._usage_callback = usage_callback  # async fn(LLMResponse, session_id, agent_name)

    def _build_config(self, provider_name: str) -> dict[str, Any]:
        key_env_map = {
            "anthropic": "ANTHROPIC_API_KEY",
            "openai":    "OPENAI_API_KEY",
            "google":    "GOOGLE_API_KEY",
            "mistral":   "MISTRAL_API_KEY",
        }
        api_key = os.getenv(key_env_map[provider_name], "")
        if not api_key:
            raise EnvironmentError(
                f"API key for provider '{provider_name}' is not set. "
                f"Set {key_env_map[provider_name]} in environment."
            )

        return {
            "api_key":        api_key,
            "model_economy":  os.getenv("LLM_DEFAULT_MODEL_ECONOMY",  ""),
            "model_standard": os.getenv("LLM_DEFAULT_MODEL_STANDARD", ""),
            "model_premium":  os.getenv("LLM_DEFAULT_MODEL_PREMIUM",  ""),
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((TimeoutError, ConnectionError)),
        reraise=True,
    )
    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Execute an LLM call with automatic retry on transient failures."""
        response = await self._provider.complete(request)
        self._validate_response(response)

        if self._usage_callback:
            await self._usage_callback(
                response,
                session_id=request.session_id,
                agent_name=request.agent_name,
            )

        return response

    def _validate_response(self, response: LLMResponse) -> None:
        if not response.content or not response.content.strip():
            raise ValueError(
                f"LLM provider '{response.provider}' returned an empty response."
            )

    @property
    def provider_name(self) -> str:
        return self._provider.provider_name
