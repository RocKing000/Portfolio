from __future__ import annotations

from openai import AsyncOpenAI

from ..base import BaseLLMProvider, LLMRequest, LLMResponse, ModelTier


class OpenAIProvider(BaseLLMProvider):
    provider_name = "openai"

    INPUT_COST_PER_1M = {
        "gpt-4o-mini": 0.15,
        "gpt-4o":      5.00,
        "gpt-4-turbo": 10.00,
    }
    OUTPUT_COST_PER_1M = {
        "gpt-4o-mini": 0.60,
        "gpt-4o":      15.00,
        "gpt-4-turbo": 30.00,
    }

    def __init__(self, config: dict):
        super().__init__(config)
        self._client = AsyncOpenAI(api_key=config["api_key"])

    async def complete(self, request: LLMRequest) -> LLMResponse:
        model = self.model_for_tier(request.model_tier)
        start = self._start_timer()

        messages = list(request.messages)
        if request.system:
            messages = [{"role": "system", "content": request.system}] + messages

        response = await self._client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
        )

        choice = response.choices[0]
        content = choice.message.content or ""
        prompt_tokens = response.usage.prompt_tokens
        completion_tokens = response.usage.completion_tokens

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
