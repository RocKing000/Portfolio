"""
ComponentDesign Agent — Component 2, Technical Design Layer (Agent 2/6)

Breaks down each architectural service into internal components with
responsibilities, interfaces, and design patterns.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a software architect decomposing services into internal components.

Return JSON:
{
  "component_designs": [
    {
      "service_id": "SVC-001",
      "service_name": "<name>",
      "internal_components": [
        {
          "id": "COMP-001",
          "name": "<component name>",
          "type": "controller|service|repository|handler|gateway|validator|mapper|factory",
          "responsibility": "<single responsibility description>",
          "interfaces": [
            {"method": "<method signature>", "purpose": "<what it does>"}
          ],
          "dependencies": ["COMP-002"],
          "design_patterns": ["Repository", "Strategy"],
          "error_handling": "<how errors surface from this component>"
        }
      ],
      "layering": "<hexagonal|layered|clean|onion>",
      "dependency_direction": "<inner→outer: domain→application→infrastructure>"
    }
  ]
}
"""


class ComponentDesignAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Design the internal components for each service.

SERVICES:
{json.dumps(state.get('services', []), indent=2)}

ARCHITECTURE BLUEPRINT:
{json.dumps(state.get('architecture_blueprint', {}), indent=2)}

TECH STACK:
{json.dumps(state.get('tech_stack', {}), indent=2)}

For each service, define its internal components, their responsibilities, and interfaces."""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.PREMIUM,
            max_tokens=6000,
        )

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            result = {"raw_components": response.content}

        component_designs = result.get("component_designs", [])
        logger.info("ComponentDesign complete: %d services decomposed",
                    len(component_designs))

        return {
            **state,
            "component_designs": component_designs,
            "current_agent":     "component_design",
        }
