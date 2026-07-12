"""
Shared base for all Component 3 specification agents.
Each agent provides a SYSTEM_PROMPT and INPUT_KEYS; the base handles LLM call + parse.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)


class LayerSpecAgent(BaseAgent):
    """
    Lightweight base for specification agents that:
    1. Pull a fixed set of state keys as context
    2. Call the LLM with a layer-specific prompt
    3. Parse JSON and merge into state under OUTPUT_KEY
    """

    SYSTEM_PROMPT: str = ""
    INPUT_KEYS:    list[str] = []
    OUTPUT_KEY:    str = "spec_output"
    MODEL_TIER:    ModelTier = ModelTier.PREMIUM
    MAX_TOKENS:    int = 5000
    AGENT_NAME:    str = ""

    def build_graph(self):
        raise NotImplementedError

    def _build_context(self, state: dict[str, Any]) -> str:
        parts = []
        for key in self.INPUT_KEYS:
            val = state.get(key)
            if val is not None:
                parts.append(f"{key.upper()}:\n{json.dumps(val, indent=2)}")
        return "\n\n".join(parts)

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        context = self._build_context(state)
        messages = [{"role": "user", "content": context}]

        response = await self.llm_call(
            messages=messages,
            system=self.SYSTEM_PROMPT,
            model_tier=self.MODEL_TIER,
            max_tokens=self.MAX_TOKENS,
        )

        try:
            output = json.loads(response.content)
        except json.JSONDecodeError:
            output = {"raw": response.content}

        logger.info("%s complete", self.AGENT_NAME or self.__class__.__name__)
        return {**state, self.OUTPUT_KEY: output, "current_agent": self.AGENT_NAME}
