"""
UIUXStrategy Agent — Component 2, Research Layer (Agent 5/7)

Defines the UX strategy: user personas, journey maps, interaction patterns,
and design system selection. Feeds the UI/UX design agents downstream.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a lead UX strategist defining the interaction design strategy for a software product.

Return JSON:
{
  "user_personas": [
    {
      "id": "PERSONA-001",
      "name": "<persona name>",
      "role": "<job role>",
      "goals": ["<goal>"],
      "pain_points": ["<pain point>"],
      "tech_literacy": "novice|intermediate|expert",
      "primary_device": "desktop|mobile|tablet|mixed"
    }
  ],
  "user_journeys": [
    {
      "persona_id": "PERSONA-001",
      "journey_name": "<e.g. First-time Setup>",
      "steps": [
        {"step": 1, "action": "<what user does>", "system_response": "<what system does>", "emotion": "confused|neutral|satisfied"}
      ],
      "success_criteria": "<what makes this journey successful>"
    }
  ],
  "interaction_patterns": [
    {
      "pattern": "<e.g. Progressive Disclosure>",
      "applied_to": ["<screen or feature>"],
      "rationale": "<why>"
    }
  ],
  "design_system_decision": {
    "system": "<Material UI|Ant Design|Chakra|custom>",
    "rationale": "<why this system>",
    "customization_scope": "minimal|moderate|heavy"
  },
  "accessibility": {
    "target_wcag": "AA|AAA",
    "key_requirements": ["keyboard nav", "screen reader support"]
  },
  "responsive_strategy": "mobile-first|desktop-first|adaptive",
  "information_architecture": {
    "navigation_pattern": "<top-nav|sidebar|hub-and-spoke>",
    "primary_sections": ["<section name>"]
  }
}
"""


class UIUXStrategyAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Define the UX strategy for this product.

REQUIREMENTS PACKAGE (users and goals section):
{json.dumps(state.get('requirements_package', {}).get('functional_requirements', [])[:10], indent=2)}

TECHNOLOGY HINTS:
{json.dumps(state.get('technology_hints', {}), indent=2)}

DESIGN CONSTRAINTS:
{json.dumps([c for c in state.get('design_constraints', []) if 'ux' in c.get('impact_areas', [])], indent=2)}

Identify user personas, map their journeys, choose interaction patterns and a design system."""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=4096,
        )

        try:
            strategy = json.loads(response.content)
        except json.JSONDecodeError:
            strategy = {"raw_strategy": response.content}

        logger.info("UIUXStrategy complete: %d personas, %d journeys",
                    len(strategy.get("user_personas", [])),
                    len(strategy.get("user_journeys", [])))

        return {
            **state,
            "user_personas":         strategy.get("user_personas", []),
            "user_journeys":         strategy.get("user_journeys", []),
            "interaction_patterns":  strategy.get("interaction_patterns", []),
            "design_system_decision": strategy.get("design_system_decision", {}),
            "accessibility_reqs":    strategy.get("accessibility", {}),
            "responsive_strategy":   strategy.get("responsive_strategy", ""),
            "information_architecture": strategy.get("information_architecture", {}),
            "current_agent":         "uiux_strategy",
        }
