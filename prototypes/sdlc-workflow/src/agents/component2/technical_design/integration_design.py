"""
IntegrationDesign Agent — Component 2, Technical Design Layer (Agent 5/6)

Translates integration requirements into concrete adapter patterns,
retry strategies, circuit breakers, and event contracts.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are an integration engineer designing resilient adapters for each external system.

Return JSON:
{
  "integration_designs": [
    {
      "integration_id": "INT-001",
      "adapter_name": "<e.g. StripePaymentAdapter>",
      "pattern": "anti_corruption_layer|facade|gateway|event_driven|polling|webhook",
      "implementation": {
        "language_layer": "<which service owns this adapter>",
        "retry_policy": {
          "max_attempts": 3,
          "backoff": "exponential|linear|fixed",
          "initial_delay_ms": 500
        },
        "circuit_breaker": {
          "enabled": true,
          "failure_threshold": 5,
          "recovery_timeout_seconds": 30
        },
        "timeout_ms": 5000,
        "bulkhead": {"enabled": false, "max_concurrent": 10}
      },
      "data_transformation": {
        "inbound_mapping": "<how external data maps to domain model>",
        "outbound_mapping": "<how domain model maps to external format>"
      },
      "error_handling": {
        "transient_errors": ["timeout", "5xx"],
        "permanent_errors": ["401", "400 validation"],
        "dead_letter_strategy": "<queue|alert|ignore>"
      },
      "testing_strategy": "<contract tests|mock|sandbox>"
    }
  ],
  "event_contracts": [
    {
      "event_name": "<EventName>",
      "producer": "<service>",
      "consumers": ["<service>"],
      "schema": {"type": "object", "properties": {}},
      "ordering_guarantee": "none|per_partition|global",
      "delivery": "at_least_once|exactly_once|at_most_once"
    }
  ]
}
"""


class IntegrationDesignAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Design resilient integration adapters for all external systems.

INTEGRATIONS IDENTIFIED:
{json.dumps(state.get('integrations', []), indent=2)}

DATA FLOWS:
{json.dumps(state.get('data_flows', []), indent=2)}

ARCHITECTURE BLUEPRINT:
Services: {json.dumps([s.get('name') for s in state.get('services', [])], indent=2)}

QUALITY ATTRIBUTES:
{json.dumps(state.get('quality_attributes', {}), indent=2)}

Design adapter patterns, retry/circuit-breaker policies, and event contracts."""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=5000,
        )

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            result = {"raw_integration_design": response.content}

        logger.info("IntegrationDesign complete: %d adapters, %d event contracts",
                    len(result.get("integration_designs", [])),
                    len(result.get("event_contracts", [])))

        return {
            **state,
            "integration_designs": result.get("integration_designs", []),
            "event_contracts":     result.get("event_contracts", []),
            "current_agent":       "integration_design",
        }
