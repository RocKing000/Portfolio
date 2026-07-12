"""
AssetDiscovery Agent — Component 2, Research Layer (Agent 2/7)

Catalogues existing codebases, APIs, design systems, and third-party services
that can be reused or must be integrated. Reduces greenfield scope.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a technical discovery specialist identifying reusable assets and integration
points for a software project based on requirements and context provided.

Return a JSON object:
{
  "existing_assets": [
    {
      "id": "ASSET-001",
      "name": "<asset name>",
      "type": "codebase|api|design_system|database|library|service",
      "reuse_strategy": "adopt|fork|wrap|reference",
      "compatibility_score": 0.0-1.0,
      "gaps": ["<what's missing compared to need>"],
      "effort_to_integrate": "low|medium|high"
    }
  ],
  "design_system": {
    "identified": true,
    "name": "<e.g. Material Design, Ant Design, custom>",
    "components_available": ["Button", "Form", "Table"],
    "customization_needed": "<description>"
  },
  "third_party_services": [
    {
      "id": "SVC-001",
      "purpose": "<auth|payment|email|storage|analytics>",
      "recommended_provider": "<provider name>",
      "alternatives": ["<alt1>", "<alt2>"],
      "rationale": "<why this provider>"
    }
  ],
  "open_source_dependencies": [
    {
      "name": "<library>",
      "purpose": "<what it solves>",
      "license": "<MIT|Apache|GPL>",
      "maturity": "stable|beta|experimental"
    }
  ],
  "reuse_savings_estimate": "<time/effort saved by reuse>"
}
"""


class AssetDiscoveryAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Discover existing assets, design systems, and third-party services.

PROJECT CONTEXT:
{json.dumps({
    'requirements_package':  state.get('requirements_package', {}),
    'technology_hints':      state.get('technology_hints', {}),
    'design_constraints':    state.get('design_constraints', []),
}, indent=2)}

Existing codebase info: {state.get('existing_codebase_info', 'None provided')}

Identify what already exists or can be reused before designing from scratch."""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=3072,
        )

        try:
            discovery = json.loads(response.content)
        except json.JSONDecodeError:
            discovery = {"raw_discovery": response.content}

        logger.info("AssetDiscovery complete: %d assets, %d services",
                    len(discovery.get("existing_assets", [])),
                    len(discovery.get("third_party_services", [])))

        return {
            **state,
            "existing_assets":     discovery.get("existing_assets", []),
            "design_system":       discovery.get("design_system", {}),
            "third_party_services": discovery.get("third_party_services", []),
            "oss_dependencies":    discovery.get("open_source_dependencies", []),
            "current_agent":       "asset_discovery",
        }
