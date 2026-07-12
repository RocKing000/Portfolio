"""
APIDesign Agent — Component 2, Technical Design Layer (Agent 4/6)

Produces a complete API contract: endpoints, request/response schemas,
auth requirements, versioning, and rate limiting per endpoint.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are an API architect designing a comprehensive REST (or GraphQL) API contract.

Return JSON:
{
  "api_style": "rest|graphql|grpc",
  "base_url": "/api/v1",
  "versioning_strategy": "url_path|header|query_param",
  "endpoints": [
    {
      "id": "EP-001",
      "path": "/resource/{id}",
      "method": "GET|POST|PUT|PATCH|DELETE",
      "summary": "<what this endpoint does>",
      "auth_required": true,
      "roles_allowed": ["Client", "ProjectLead"],
      "request": {
        "path_params": [{"name": "id", "type": "uuid"}],
        "query_params": [{"name": "page", "type": "integer", "required": false}],
        "body_schema": {
          "type": "object",
          "properties": {
            "<field>": {"type": "<type>", "required": true, "description": "<desc>"}
          }
        }
      },
      "responses": {
        "200": {"description": "Success", "schema": {"type": "object"}},
        "400": {"description": "Validation error"},
        "401": {"description": "Unauthorized"},
        "404": {"description": "Not found"}
      },
      "rate_limit": {"requests_per_minute": 60, "scope": "user|ip|global"},
      "idempotent": true,
      "caching": {"enabled": false, "ttl_seconds": 0}
    }
  ],
  "error_schema": {
    "format": {"error": "string", "code": "string", "details": "array"},
    "conventions": ["snake_case fields", "RFC 7807 problem+json"]
  },
  "pagination": {
    "strategy": "cursor|offset|page",
    "default_page_size": 20,
    "max_page_size": 100
  }
}
"""


class APIDesignAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Design the complete API contract.

SERVICES AND COMPONENTS:
{json.dumps([
    {'service': s.get('name'), 'responsibility': s.get('responsibility')}
    for s in state.get('services', [])
], indent=2)}

ENTITIES:
{json.dumps([{'name': e.get('name'), 'key': e.get('primary_key')} for e in state.get('entities', [])], indent=2)}

AUTH ARCHITECTURE:
{json.dumps(state.get('auth_architecture', {}), indent=2)}

FUNCTIONAL REQUIREMENTS:
{json.dumps(state.get('requirements_package', {}).get('functional_requirements', [])[:10], indent=2)}

API PARADIGM: {state.get('technology_hints', {}).get('backend_paradigm', 'REST')}

Design all API endpoints with schemas, auth, and error handling."""
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
            result = {"raw_api": response.content}

        logger.info("APIDesign complete: %d endpoints, style=%s",
                    len(result.get("endpoints", [])),
                    result.get("api_style", "unknown"))

        return {
            **state,
            "api_contract":  result,
            "api_endpoints": result.get("endpoints", []),
            "api_style":     result.get("api_style", "rest"),
            "current_agent": "api_design",
        }
