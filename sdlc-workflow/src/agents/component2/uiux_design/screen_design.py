"""
ScreenDesign Agent — Component 2, UI/UX Design Layer (Agent 3/7)

Produces screen-level wireframe specifications: layout, component placement,
content hierarchy, and responsive breakpoint behaviour.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a UI designer specifying screen layouts and wireframe content.

Return JSON:
{
  "screens": [
    {
      "id": "SCR-001",
      "name": "<screen name>",
      "route": "/path",
      "persona_ids": ["PERSONA-001"],
      "journey_steps": [1, 2],
      "layout": {
        "type": "full_page|modal|drawer|split_pane|dashboard",
        "regions": [
          {
            "region": "header|sidebar|main|aside|footer",
            "components": ["DS-001", "DS-002"],
            "responsive_behaviour": "<hides on mobile|stacks below>",
            "content": "<description of content in this region>"
          }
        ]
      },
      "primary_action": "<what the user achieves on this screen>",
      "data_requirements": ["<entity or API endpoint needed>"],
      "empty_state": "<what shows when no data>",
      "error_state": "<what shows on error>",
      "loading_state": "<skeleton|spinner|none>",
      "accessibility_notes": "<specific a11y requirements for this screen>"
    }
  ]
}
"""


class ScreenDesignAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Design all screen layouts for this application.

USER JOURNEYS:
{json.dumps(state.get('user_journeys', []), indent=2)}

INFORMATION ARCHITECTURE:
{json.dumps(state.get('information_architecture', {}), indent=2)}

API ENDPOINTS (data available):
{json.dumps([ep.get('path') + ' ' + ep.get('method', '') for ep in state.get('api_endpoints', [])[:20]], indent=2)}

COMPONENT CATALOGUE (available components):
{json.dumps([c.get('name') for c in state.get('component_catalogue', [])], indent=2)}

PERSONAS:
{json.dumps([{'id': p.get('id'), 'name': p.get('name'), 'device': p.get('primary_device')} for p in state.get('user_personas', [])], indent=2)}

Design every screen needed to satisfy the user journeys."""
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
            result = {"raw_screens": response.content}

        screens = result.get("screens", [])
        logger.info("ScreenDesign complete: %d screens specified", len(screens))

        return {
            **state,
            "screen_designs": screens,
            "current_agent":  "screen_design",
        }
