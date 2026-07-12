from __future__ import annotations

import google.generativeai as genai

from ..base import BaseLLMProvider, LLMRequest, LLMResponse, ModelTier


class GoogleProvider(BaseLLMProvider):
    provider_name = "google"

    INPUT_COST_PER_1M = {
        "gemini-1.5-flash": 0.075,
        "gemini-1.5-pro":   3.50,
    }
    OUTPUT_COST_PER_1M = {
        "gemini-1.5-flash": 0.30,
        "gemini-1.5-pro":   10.50,
    }

    def __init__(self, config: dict):
        super().__init__(config)
        genai.configure(api_key=config["api_key"])

    async def complete(self, request: LLMRequest) -> LLMResponse:
        model_name = self.model_for_tier(request.model_tier)
        start = self._start_timer()

        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=request.system,
        )

        # Convert OpenAI-style messages to Gemini format
        gemini_messages = []
        for msg in request.messages:
            role = "user" if msg["role"] == "user" else "model"
            gemini_messages.append({"role": role, "parts": [msg["content"]]})

        response = await model.generate_content_async(
            gemini_messages,
            generation_config=genai.GenerationConfig(
                max_output_tokens=request.max_tokens,
                temperature=request.temperature,
            ),
        )

        content = response.text or ""
        usage = response.usage_metadata
        prompt_tokens = usage.prompt_token_count if usage else 0
        completion_tokens = usage.candidates_token_count if usage else 0

        return LLMResponse(
            content=content,
            provider=self.provider_name,
            model=model_name,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            latency_ms=self._elapsed_ms(start),
            estimated_cost_usd=self.estimate_cost(model_name, prompt_tokens, completion_tokens),
            raw_response=response,
        )
