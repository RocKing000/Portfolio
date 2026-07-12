from __future__ import annotations

from mistralai import Mistral

from ..base import BaseLLMProvider, LLMRequest, LLMResponse, ModelTier


class MistralProvider(BaseLLMProvider):
    provider_name = "mistral"

    INPUT_COST_PER_1M = {
        "mistral-small-latest": 2.00,
        "mistral-large-latest": 8.00,
    }
    OUTPUT_COST_PER_1M = {
        "mistral-small-latest": 6.00,
        "mistral-large-latest": 24.00,
    }

    def __init__(self, config: dict):
        super().__init__(config)
        self._client = Mistral(api_key=config["api_key"])

    async def complete(self, request: LLMRequest) -> LLMResponse:
        model = self.model_for_tier(request.model_tier)
        start = self._start_timer()

        messages = list(request.messages)
        if request.system:
            messages = [{"role": "system", "content": request.system}] + messages

        response = await self._client.chat.complete_async(
            model=model,
            messages=messages,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
        )

        content = response.choices[0].message.content or ""
        usage = response.usage
        prompt_tokens = usage.prompt_tokens if usage else 0
        completion_tokens = usage.completion_tokens if usage else 0

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
