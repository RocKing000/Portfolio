"""
FigmaWorkspace Agent — Component 2, UI/UX Design Layer (Agent 1/7)

Sets up the Figma workspace: creates pages for each user journey,
initialises component pages, and seeds the design tokens from the
chosen design system. Outputs the Figma file URL stored in session state.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a senior product designer setting up a Figma workspace for a new project.
Since you cannot directly call the Figma API here, produce a structured workspace plan
that a Figma plugin or automation script will execute.

Return JSON:
{
  "workspace_plan": {
    "file_name": "<ProjectName> Design System",
    "pages": [
      {
        "name": "<page name>",
        "purpose": "<what designs live here>",
        "frames": ["<frame 1>", "<frame 2>"]
      }
    ],
    "design_tokens": {
      "colors": {
        "primary":    "#RRGGBB",
        "secondary":  "#RRGGBB",
        "background": "#RRGGBB",
        "surface":    "#RRGGBB",
        "error":      "#RRGGBB",
        "text":       "#RRGGBB",
        "text_muted": "#RRGGBB"
      },
      "typography": {
        "font_family": "<font>",
        "scale": ["12", "14", "16", "20", "24", "32", "40", "48"]
      },
      "spacing": {"base": "8px", "scale": ["4", "8", "16", "24", "32", "48", "64", "96"]},
      "border_radius": {"small": "4px", "medium": "8px", "large": "16px", "full": "9999px"},
      "shadows": ["none", "sm", "md", "lg", "xl"]
    },
    "component_pages": ["Atoms", "Molecules", "Organisms", "Templates"],
    "journey_pages": ["<journey name from user_journeys>"]
  },
  "figma_file_url": "https://figma.com/file/placeholder",
  "embed_url": "https://figma.com/embed?url=placeholder",
  "workspace_status": "planned"
}
"""


class FigmaWorkspaceAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Plan the Figma workspace structure for this project.

PROJECT CONTEXT:
- Design System: {json.dumps(state.get('design_system_decision', {}), indent=2)}
- User Personas: {json.dumps([p.get('name') for p in state.get('user_personas', [])], indent=2)}
- User Journeys: {json.dumps([j.get('journey_name') for j in state.get('user_journeys', [])], indent=2)}
- Information Architecture: {json.dumps(state.get('information_architecture', {}), indent=2)}
- Responsive Strategy: {state.get('responsive_strategy', 'desktop-first')}
- Accessibility Target: {state.get('accessibility_reqs', {}).get('target_wcag', 'AA')}

Quality attributes: {json.dumps(state.get('quality_attributes', {}), indent=2)}

Create a complete Figma workspace plan with design tokens derived from the design system."""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=3000,
        )

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            result = {"raw_workspace": response.content}

        plan = result.get("workspace_plan", {})
        logger.info("FigmaWorkspace planned: %d pages, %d journey pages",
                    len(plan.get("pages", [])),
                    len(plan.get("journey_pages", [])))

        return {
            **state,
            "figma_workspace_plan": plan,
            "design_tokens":        plan.get("design_tokens", {}),
            "figma_file_url":       result.get("figma_file_url", ""),
            "figma_embed_url":      result.get("embed_url", ""),
            "figma_workspace_status": result.get("workspace_status", "planned"),
            "current_agent":        "figma_workspace",
        }
