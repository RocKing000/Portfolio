"""
DesignSystemSpec Agent — Component 2, UI/UX Design Layer (Agent 2/7)

Produces the full design system specification: component library catalogue,
variant definitions, usage rules, and theming tokens.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a design system architect specifying a component library.

Return JSON:
{
  "design_system_spec": {
    "name": "<Design System Name>",
    "base_library": "<Material UI|Ant Design|Chakra|Tailwind|custom>",
    "atomic_components": [
      {
        "id": "DS-001",
        "name": "<Button>",
        "category": "atom|molecule|organism|template",
        "variants": ["primary", "secondary", "ghost", "danger"],
        "states": ["default", "hover", "active", "disabled", "loading"],
        "props": [
          {"name": "<propName>", "type": "<type>", "required": true, "description": "<desc>"}
        ],
        "accessibility": {"aria_role": "<role>", "keyboard_support": "<Tab, Enter>"},
        "usage_rules": ["<do>"],
        "anti_patterns": ["<don't>"]
      }
    ],
    "layout_system": {
      "grid": "<12-column|CSS Grid|Flexbox>",
      "breakpoints": {
        "sm": "640px",
        "md": "768px",
        "lg": "1024px",
        "xl": "1280px"
      },
      "container_max_width": "1280px"
    },
    "theming": {
      "dark_mode_supported": false,
      "brand_customizable": true,
      "token_format": "CSS custom properties|Figma tokens|Style Dictionary"
    },
    "icon_library": "<Heroicons|Material Icons|Lucide>",
    "motion": {
      "duration_fast": "150ms",
      "duration_normal": "300ms",
      "easing": "cubic-bezier(0.4,0,0.2,1)"
    }
  }
}
"""


class DesignSystemSpecAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Produce the complete design system specification.

DESIGN SYSTEM DECISION: {json.dumps(state.get('design_system_decision', {}), indent=2)}
DESIGN TOKENS: {json.dumps(state.get('design_tokens', {}), indent=2)}
INTERACTION PATTERNS: {json.dumps(state.get('interaction_patterns', []), indent=2)}
ACCESSIBILITY: {json.dumps(state.get('accessibility_reqs', {}), indent=2)}
RESPONSIVE STRATEGY: {state.get('responsive_strategy')}
INFORMATION ARCHITECTURE: {json.dumps(state.get('information_architecture', {}), indent=2)}

Define all atomic components, their variants, states, props, and accessibility requirements."""
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
            result = {"raw_ds_spec": response.content}

        spec = result.get("design_system_spec", result)
        logger.info("DesignSystemSpec complete: %d components defined",
                    len(spec.get("atomic_components", [])))

        return {
            **state,
            "design_system_spec": spec,
            "component_catalogue": spec.get("atomic_components", []),
            "layout_system":      spec.get("layout_system", {}),
            "current_agent":      "design_system_spec",
        }
