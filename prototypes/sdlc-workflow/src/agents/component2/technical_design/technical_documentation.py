"""
TechnicalDocumentation Agent — Component 2, Technical Design Layer (Agent 6/6)

Assembles the design package for Gate 2 review: ADRs, module spec index,
and the complete technical design summary document.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a technical writer assembling a comprehensive technical design document.

Return JSON:
{
  "design_document": {
    "title": "<Project> Technical Design Document v1.0",
    "executive_summary": "<3-4 sentence summary for non-technical stakeholders>",
    "architecture_summary": "<architecture pattern and key decisions>",
    "services_summary": [
      {"name": "<service>", "purpose": "<one line>", "tech": "<stack>"}
    ],
    "data_model_summary": "<key entities and their relationships>",
    "api_summary": "<API style, total endpoints, auth approach>",
    "integration_summary": "<external systems and adapter patterns>",
    "uiux_summary": "<design system and personas>",
    "risk_summary": "<top 3 risks and mitigations>",
    "open_questions": ["<unresolved design decision>"],
    "next_steps": ["<what C3 implementation needs to know>"]
  },
  "adrs": [
    {
      "id": "ADR-001",
      "title": "<decision title>",
      "status": "accepted|proposed|deprecated",
      "context": "<why a decision was needed>",
      "decision": "<what was decided>",
      "consequences": "<what this implies for the build>",
      "alternatives_considered": ["<alt>"]
    }
  ],
  "module_spec_index": [
    {
      "module_id": "MOD-001",
      "name": "<module name>",
      "layer": "frontend|backend|data|integration|ai_ml",
      "service": "<parent service>",
      "components": ["COMP-001"],
      "estimated_effort": "XS|S|M|L|XL",
      "dependencies": ["MOD-002"]
    }
  ]
}
"""


class TechnicalDocumentationAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Assemble the technical design document and module spec index.

ARCHITECTURE BLUEPRINT:
{json.dumps(state.get('architecture_blueprint', {}), indent=2)}

COMPONENT DESIGNS (count): {len(state.get('component_designs', []))} service designs

API CONTRACT: {len(state.get('api_endpoints', []))} endpoints, style={state.get('api_style')}

DATA MODEL: {len(state.get('entities', []))} entities

INTEGRATION DESIGNS: {len(state.get('integration_designs', []))} adapters

UX STRATEGY:
{json.dumps({
    'personas': len(state.get('user_personas', [])),
    'design_system': state.get('design_system_decision', {}),
}, indent=2)}

RISK REGISTER: {len(state.get('risk_register', []))} risks, top 5: {state.get('top_risks', [])}

KEY ADRs:
{json.dumps(state.get('key_adrs', []), indent=2)}

Produce the complete design document, all ADRs, and the module spec index for Gate 2."""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.PREMIUM,
            max_tokens=8000,
        )

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            result = {"raw_documentation": response.content}

        module_specs = result.get("module_spec_index", [])
        logger.info("TechnicalDocumentation complete: %d ADRs, %d modules",
                    len(result.get("adrs", [])),
                    len(module_specs))

        # Assemble the final design package for Gate 2 and C3 handoff
        design_package = {
            "architecture_blueprint": state.get("architecture_blueprint"),
            "services":               state.get("services"),
            "component_designs":      state.get("component_designs"),
            "data_model":             state.get("data_model"),
            "api_contract":           state.get("api_contract"),
            "integration_designs":    state.get("integration_designs"),
            "event_contracts":        state.get("event_contracts"),
            "uiux_strategy": {
                "user_personas":      state.get("user_personas"),
                "user_journeys":      state.get("user_journeys"),
                "design_system":      state.get("design_system_decision"),
                "information_arch":   state.get("information_architecture"),
            },
            "module_spec_index":      module_specs,
            "adrs":                   result.get("adrs"),
            "risk_register":          state.get("risk_register"),
            "design_document":        result.get("design_document"),
        }

        return {
            **state,
            "design_document":  result.get("design_document", {}),
            "adrs":             result.get("adrs", []),
            "module_spec_index": module_specs,
            "design_package":   design_package,
            "current_agent":    "technical_documentation",
        }
