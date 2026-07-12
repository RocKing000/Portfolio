"""
ArchitectureOptions Agent — Component 2, Research Layer (Agent 4/7)

Generates 2–3 candidate architecture patterns and scores them against
the quality attributes and constraints. Produces the recommended option
that the technical design layer will elaborate.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a chief architect generating architecture options for a software system.
Produce 2-3 candidate patterns, score them, and recommend one.

Return JSON:
{
  "options": [
    {
      "id": "OPT-A",
      "name": "<e.g. Monolithic Layered>",
      "pattern": "<monolith|microservices|modular-monolith|event-driven|serverless|hybrid>",
      "description": "<2-3 sentence summary>",
      "scores": {
        "scalability":     0.0-1.0,
        "maintainability": 0.0-1.0,
        "time_to_market":  0.0-1.0,
        "cost":            0.0-1.0,
        "security":        0.0-1.0
      },
      "strengths": ["<strength>"],
      "weaknesses": ["<weakness>"],
      "team_size_fit": "<1-3|3-10|10+>",
      "suits_when": "<context where this option wins>"
    }
  ],
  "recommended_option": "OPT-A",
  "recommendation_rationale": "<why this option given the constraints>",
  "key_architectural_decisions": [
    {
      "decision": "<specific ADR title>",
      "chosen": "<chosen approach>",
      "rejected": ["<alt1>", "<alt2>"],
      "rationale": "<why>"
    }
  ],
  "component_map": {
    "<layer or service name>": "<responsibility>"
  }
}
"""


class ArchitectureOptionsAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Generate architecture options for this system.

TECH STACK RECOMMENDATION:
{json.dumps(state.get('tech_stack', {}), indent=2)}

QUALITY ATTRIBUTES:
{json.dumps(state.get('quality_attributes', {}), indent=2)}

FEASIBILITY ASSESSMENT:
{json.dumps(state.get('feasibility_assessment', {}).get('feasibility_per_area', {}), indent=2)}

DESIGN CONSTRAINTS:
{json.dumps(state.get('design_constraints', []), indent=2)}

EXISTING ASSETS:
{json.dumps([a.get('name') for a in state.get('existing_assets', [])], indent=2)}

Gate 1 corrections (if any): {json.dumps(state.get('gate1_corrections', {}), indent=2)}

Produce 2-3 architecture patterns and recommend the best fit."""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.PREMIUM,
            max_tokens=5000,
        )

        try:
            arch = json.loads(response.content)
        except json.JSONDecodeError:
            arch = {"raw_arch": response.content}

        logger.info("ArchitectureOptions complete: %d options, recommended=%s",
                    len(arch.get("options", [])),
                    arch.get("recommended_option"))

        return {
            **state,
            "architecture_options":   arch.get("options", []),
            "recommended_arch":       arch.get("recommended_option"),
            "arch_recommendation_rationale": arch.get("recommendation_rationale", ""),
            "key_adrs":               arch.get("key_architectural_decisions", []),
            "component_map":          arch.get("component_map", {}),
            "current_agent":          "architecture_options",
        }
