"""
InteractionFlow Agent — Component 2, UI/UX Design Layer (Agent 4/7)

Maps transitions between screens, micro-interactions, form validation flows,
and error recovery paths. Produces the interaction specification.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are an interaction designer specifying all screen transitions and micro-interactions.

Return JSON:
{
  "flows": [
    {
      "id": "FLOW-001",
      "name": "<flow name e.g. User Registration>",
      "persona_id": "PERSONA-001",
      "entry_screen": "SCR-001",
      "exit_screen": "SCR-003",
      "transitions": [
        {
          "from_screen": "SCR-001",
          "trigger": "<user action: click|submit|swipe|timer>",
          "action_element": "<button/form/link name>",
          "to_screen": "SCR-002",
          "animation": "push|fade|slide|none",
          "duration_ms": 300,
          "conditions": ["<condition e.g. form valid>"],
          "error_path": "SCR-001"
        }
      ],
      "happy_path": ["SCR-001", "SCR-002", "SCR-003"],
      "error_paths": [{"from": "SCR-002", "condition": "<error>", "goes_to": "SCR-001", "recovery": "<instruction>"}]
    }
  ],
  "micro_interactions": [
    {
      "component": "<DS component name>",
      "trigger": "hover|focus|click|load|scroll",
      "feedback": "<visual or haptic feedback description>",
      "duration_ms": 150,
      "purpose": "<why this micro-interaction exists>"
    }
  ],
  "form_validation_rules": [
    {
      "screen_id": "SCR-001",
      "field": "<field name>",
      "validations": [
        {"rule": "required|minLength|pattern|custom", "message": "<user-facing error message>", "when": "blur|submit|change"}
      ]
    }
  ],
  "loading_patterns": [
    {"context": "<screen or action>", "pattern": "skeleton|spinner|progress_bar|inline", "timeout_message": "<message if >5s>"}
  ]
}
"""


class InteractionFlowAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Specify all interaction flows and micro-interactions.

SCREENS:
{json.dumps([{'id': s.get('id'), 'name': s.get('name'), 'route': s.get('route'), 'primary_action': s.get('primary_action')} for s in state.get('screen_designs', [])], indent=2)}

USER JOURNEYS:
{json.dumps(state.get('user_journeys', []), indent=2)}

INTERACTION PATTERNS:
{json.dumps(state.get('interaction_patterns', []), indent=2)}

Map every navigation transition, form validation, and loading pattern."""
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
            result = {"raw_flows": response.content}

        logger.info("InteractionFlow complete: %d flows, %d micro-interactions",
                    len(result.get("flows", [])),
                    len(result.get("micro_interactions", [])))

        return {
            **state,
            "interaction_flows":    result.get("flows", []),
            "micro_interactions":   result.get("micro_interactions", []),
            "form_validation_rules": result.get("form_validation_rules", []),
            "loading_patterns":     result.get("loading_patterns", []),
            "current_agent":        "interaction_flow",
        }
