"""
TechnicalFeasibility Agent — Component 2, Research Layer (Agent 3/7)

Assesses whether the desired system can be built within stated constraints.
Flags blockers, proposes fallbacks, and provides confidence scores per requirement.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a principal engineer conducting technical feasibility analysis.
Evaluate whether each stated design constraint and requirement is achievable
given technology hints and existing assets.

Return JSON:
{
  "overall_feasibility": "high|medium|low",
  "blockers": [
    {
      "id": "BLK-001",
      "description": "<what cannot be built as specified>",
      "source_constraint": "<DC-xxx or requirement ID>",
      "proposed_alternative": "<what can be done instead>",
      "severity": "critical|major|minor"
    }
  ],
  "risks": [
    {
      "id": "RISK-001",
      "description": "<technical risk>",
      "probability": "low|medium|high",
      "impact": "low|medium|high",
      "mitigation": "<mitigation strategy>"
    }
  ],
  "feasibility_per_area": {
    "frontend": {"feasibility": "high", "notes": ""},
    "backend":  {"feasibility": "high", "notes": ""},
    "data":     {"feasibility": "medium", "notes": ""},
    "ai_ml":    {"feasibility": "low", "notes": ""},
    "integration": {"feasibility": "high", "notes": ""}
  },
  "recommended_tech_stack": {
    "frontend":  "<framework>",
    "backend":   "<framework/language>",
    "database":  "<primary db technology>",
    "cache":     "<caching solution>",
    "messaging": "<message broker if needed>",
    "ai_ml":     "<model/framework if needed>",
    "devops":    "<container/orchestration>"
  },
  "prototype_recommendations": ["<specific PoC areas to validate before full build>"]
}
"""


class TechnicalFeasibilityAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Assess technical feasibility for this project.

DESIGN CONSTRAINTS:
{json.dumps(state.get('design_constraints', []), indent=2)}

NON-NEGOTIABLES:
{json.dumps(state.get('non_negotiables', []), indent=2)}

TECHNOLOGY HINTS:
{json.dumps(state.get('technology_hints', {}), indent=2)}

EXISTING ASSETS:
{json.dumps(state.get('existing_assets', []), indent=2)}

QUALITY ATTRIBUTES:
{json.dumps(state.get('quality_attributes', {}), indent=2)}

Determine what is and isn't feasible. Recommend the technology stack."""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.PREMIUM,
            max_tokens=4096,
        )

        try:
            feasibility = json.loads(response.content)
        except json.JSONDecodeError:
            feasibility = {"raw_feasibility": response.content}

        if feasibility.get("overall_feasibility") == "low" and feasibility.get("blockers"):
            logger.warning("TechnicalFeasibility: LOW feasibility with %d blockers",
                           len(feasibility.get("blockers", [])))

        return {
            **state,
            "feasibility_assessment":    feasibility,
            "tech_stack":                feasibility.get("recommended_tech_stack", {}),
            "feasibility_blockers":      feasibility.get("blockers", []),
            "technical_risks":           feasibility.get("risks", []),
            "current_agent":             "technical_feasibility",
        }
