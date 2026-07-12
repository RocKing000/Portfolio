from __future__ import annotations

import anthropic

from ..base import BaseLLMProvider, LLMRequest, LLMResponse, ModelTier


class AnthropicProvider(BaseLLMProvider):
    provider_name = "anthropic"

    INPUT_COST_PER_1M = {
        "claude-haiku-4-5-20251001": 1.00,
        "claude-sonnet-4-6":         3.00,
        "claude-opus-4-7":           15.00,
    }
    OUTPUT_COST_PER_1M = {
        "claude-haiku-4-5-20251001": 5.00,
        "claude-sonnet-4-6":         15.00,
        "claude-opus-4-7":           75.00,
    }

    def __init__(self, config: dict):
        super().__init__(config)
        self._client = anthropic.AsyncAnthropic(api_key=config["api_key"])

    async def complete(self, request: LLMRequest) -> LLMResponse:
        model = self.model_for_tier(request.model_tier)
        start = self._start_timer()

        kwargs: dict = {
            "model": model,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "messages": request.messages,
        }
        if request.system:
            kwargs["system"] = request.system

        response = await self._client.messages.create(**kwargs)

        content = response.content[0].text if response.content else ""
        prompt_tokens = response.usage.input_tokens
        completion_tokens = response.usage.output_tokens

        return LLMResponse(
            content=content,
            provider=self.provider_name,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            latency_ms=self._elapsed_ms(start),
            estimated_cost_usd=self.estimate_cost(model, prompt_tokens, completion_tokens),
            raw_response=response,
        )
