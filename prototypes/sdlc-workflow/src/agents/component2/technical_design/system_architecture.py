"""
SystemArchitecture Agent — Component 2, Technical Design Layer (Agent 1/6)

Elaborates the recommended architecture option into a full architectural blueprint:
layers, services/modules, deployment topology, and cross-cutting concerns.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a solution architect elaborating an architecture blueprint from a chosen pattern.

Return JSON:
{
  "architecture_blueprint": {
    "pattern": "<chosen pattern>",
    "layers": [
      {
        "name": "<layer name e.g. Presentation>",
        "responsibility": "<what this layer owns>",
        "technologies": ["<tech>"],
        "components": ["<component name>"]
      }
    ],
    "services": [
      {
        "id": "SVC-001",
        "name": "<service name>",
        "type": "api|worker|scheduler|gateway|cache|queue",
        "responsibility": "<what it does>",
        "exposed_ports": [8080],
        "dependencies": ["SVC-002"],
        "scalability_mode": "horizontal|vertical|none",
        "state": "stateless|stateful"
      }
    ],
    "deployment_topology": {
      "environments": ["dev", "staging", "prod"],
      "containerisation": "docker|kubernetes|none",
      "cloud_agnostic": true,
      "cdn_required": false,
      "load_balancer": true
    },
    "cross_cutting_concerns": {
      "logging":       "<strategy>",
      "tracing":       "<strategy>",
      "auth":          "<where enforced>",
      "rate_limiting": "<approach>",
      "caching":       "<strategy>",
      "error_handling":"<pattern>"
    },
    "architecture_diagram_description": "<textual C4-style description>"
  }
}
"""


class SystemArchitectureAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Elaborate the system architecture blueprint.

RECOMMENDED ARCHITECTURE: {state.get('recommended_arch')}
RATIONALE: {state.get('arch_recommendation_rationale')}

TECH STACK:
{json.dumps(state.get('tech_stack', {}), indent=2)}

COMPONENT MAP:
{json.dumps(state.get('component_map', {}), indent=2)}

KEY ADRs:
{json.dumps(state.get('key_adrs', []), indent=2)}

INTEGRATIONS:
{json.dumps(state.get('integrations', []), indent=2)}

QUALITY ATTRIBUTES:
{json.dumps(state.get('quality_attributes', {}), indent=2)}

Gate 1 corrections: {json.dumps(state.get('gate1_corrections', {}), indent=2)}

Produce the full architectural blueprint with services, layers, and deployment topology."""
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
            result = {"raw_architecture": response.content}

        blueprint = result.get("architecture_blueprint", result)
        logger.info("SystemArchitecture complete: %d services, %d layers",
                    len(blueprint.get("services", [])),
                    len(blueprint.get("layers", [])))

        return {
            **state,
            "architecture_blueprint": blueprint,
            "services":               blueprint.get("services", []),
            "layers":                 blueprint.get("layers", []),
            "deployment_topology":    blueprint.get("deployment_topology", {}),
            "current_agent":          "system_architecture",
        }
