from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ModelTier(str, Enum):
    ECONOMY = "Economy"
    STANDARD = "Standard"
    PREMIUM = "Premium"


@dataclass
class LLMRequest:
    messages: list[dict[str, str]]
    system: str | None = None
    model_tier: ModelTier = ModelTier.STANDARD
    max_tokens: int = 4096
    temperature: float = 0.2
    session_id: str | None = None
    agent_name: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class LLMResponse:
    content: str
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: int
    estimated_cost_usd: float
    raw_response: Any = None


class BaseLLMProvider(ABC):
    """Abstract base for all LLM providers. Every provider must implement this."""

    provider_name: str = "base"

    # Cost per 1M tokens in USD — subclasses override per model
    INPUT_COST_PER_1M: dict[str, float] = {}
    OUTPUT_COST_PER_1M: dict[str, float] = {}

    def __init__(self, config: dict[str, Any]):
        self.config = config
        self._model_map: dict[ModelTier, str] = {
            ModelTier.ECONOMY: config.get("model_economy", ""),
            ModelTier.STANDARD: config.get("model_standard", ""),
            ModelTier.PREMIUM: config.get("model_premium", ""),
        }

    def model_for_tier(self, tier: ModelTier) -> str:
        model = self._model_map.get(tier, "")
        if not model:
            raise ValueError(f"No model configured for tier {tier} on provider {self.provider_name}")
        return model

    def estimate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        input_rate = self.INPUT_COST_PER_1M.get(model, 0.0)
        output_rate = self.OUTPUT_COST_PER_1M.get(model, 0.0)
        return (prompt_tokens / 1_000_000 * input_rate) + (completion_tokens / 1_000_000 * output_rate)

    @abstractmethod
    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Execute a completion call and return a normalized LLMResponse."""

    def _start_timer(self) -> float:
        return time.monotonic()

    def _elapsed_ms(self, start: float) -> int:
        return int((time.monotonic() - start) * 1000)
