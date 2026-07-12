"""
DependencyIntegration Agent — Component 2, Research Layer (Agent 6/7)

Maps all external system integrations: APIs, data sources, identity providers,
payment processors, etc. Produces integration contracts and auth patterns.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are an integration architect mapping all external system touchpoints.

Return JSON:
{
  "integrations": [
    {
      "id": "INT-001",
      "system_name": "<external system>",
      "integration_type": "rest_api|graphql|grpc|webhook|message_queue|database|sdk|file",
      "direction": "inbound|outbound|bidirectional",
      "purpose": "<why we integrate>",
      "auth_mechanism": "api_key|oauth2|jwt|basic|mtls|none",
      "data_exchanged": ["<data type>"],
      "latency_tolerance": "real_time|near_real_time|batch|async",
      "fallback_strategy": "<what happens if integration fails>",
      "contract": {
        "protocol": "<HTTP/gRPC/AMQP>",
        "format": "<JSON/protobuf/XML>",
        "versioning": "<how API versioning is handled>"
      }
    }
  ],
  "auth_architecture": {
    "identity_provider": "<Keycloak|Auth0|Azure AD|Cognito>",
    "auth_flows": ["authorization_code", "client_credentials"],
    "token_strategy": "<JWT|opaque|session>",
    "mfa_required": false
  },
  "data_flows": [
    {
      "from": "<system>",
      "to": "<system>",
      "data": "<what flows>",
      "trigger": "<event|schedule|request>",
      "transformation_needed": true
    }
  ],
  "integration_risks": [
    {"integration_id": "INT-001", "risk": "<description>", "mitigation": "<approach>"}
  ]
}
"""


class DependencyIntegrationAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Map all external system integrations required.

REQUIREMENTS:
{json.dumps(state.get('requirements_package', {}).get('functional_requirements', []), indent=2)}

THIRD-PARTY SERVICES IDENTIFIED:
{json.dumps(state.get('third_party_services', []), indent=2)}

TECHNOLOGY HINTS:
{json.dumps(state.get('technology_hints', {}), indent=2)}

ARCHITECTURE PATTERN:
{state.get('recommended_arch', 'Not yet decided')}

Map every external touchpoint, define auth and fallback strategies."""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=4096,
        )

        try:
            integration = json.loads(response.content)
        except json.JSONDecodeError:
            integration = {"raw_integration": response.content}

        logger.info("DependencyIntegration complete: %d integrations",
                    len(integration.get("integrations", [])))

        return {
            **state,
            "integrations":      integration.get("integrations", []),
            "auth_architecture": integration.get("auth_architecture", {}),
            "data_flows":        integration.get("data_flows", []),
            "integration_risks": integration.get("integration_risks", []),
            "current_agent":     "dependency_integration",
        }
