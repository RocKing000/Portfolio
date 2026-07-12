"""
DesignReview Agent — Component 2, UI/UX Design Layer (Agent 5/7)

Performs a structured self-review of all design artefacts against:
- Original requirements and constraints
- Accessibility WCAG criteria
- Design system consistency
- Persona coverage
Produces a review report and flags any gaps before Gate 3.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a design QA specialist reviewing a complete UI/UX design package.
Check for coverage gaps, accessibility issues, consistency problems, and unmet requirements.

Return JSON:
{
  "review_report": {
    "overall_status": "pass|conditional_pass|fail",
    "requirements_coverage": {
      "covered": ["<req ID>"],
      "partially_covered": ["<req ID>"],
      "not_covered": ["<req ID>"]
    },
    "persona_coverage": [
      {"persona_id": "PERSONA-001", "journeys_covered": ["FLOW-001"], "gaps": ["<missing journey>"]}
    ],
    "accessibility_audit": {
      "wcag_level": "AA",
      "issues": [
        {"severity": "error|warning", "criterion": "1.4.3", "description": "<issue>", "affected_screens": ["SCR-001"], "fix": "<how to fix>"}
      ],
      "passes": ["<WCAG criterion that passes>"]
    },
    "design_consistency": {
      "token_violations": ["<component using wrong colour>"],
      "component_misuse": ["<component used incorrectly>"],
      "spacing_violations": ["<non-standard spacing>"]
    },
    "gaps": [
      {"id": "GAP-001", "type": "missing_screen|missing_flow|missing_state", "description": "<gap>", "severity": "critical|major|minor"}
    ],
    "recommendations": ["<design improvement>"],
    "ready_for_gate3": true
  }
}
"""


class DesignReviewAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Review the complete design package for quality and completeness.

REQUIREMENTS:
{json.dumps(state.get('requirements_package', {}).get('functional_requirements', [])[:15], indent=2)}

DESIGN CONSTRAINTS:
{json.dumps(state.get('design_constraints', []), indent=2)}

ACCESSIBILITY TARGET: {state.get('accessibility_reqs', {}).get('target_wcag', 'AA')}

SCREENS DESIGNED: {len(state.get('screen_designs', []))} screens
INTERACTION FLOWS: {len(state.get('interaction_flows', []))} flows
PERSONAS: {json.dumps([p.get('name') for p in state.get('user_personas', [])], indent=2)}
COMPONENT CATALOGUE: {len(state.get('component_catalogue', []))} components

DESIGN TOKENS DEFINED: {list(state.get('design_tokens', {}).get('colors', {}).keys())}

Review everything and identify any gaps or accessibility issues before Gate 3."""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=4000,
        )

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            result = {"raw_review": response.content}

        report = result.get("review_report", result)
        status = report.get("overall_status", "conditional_pass")
        logger.info("DesignReview complete: status=%s, gaps=%d",
                    status, len(report.get("gaps", [])))

        if status == "fail":
            await self.enter_safe_mode(
                reason=f"Design review FAILED with {len(report.get('gaps', []))} critical gaps"
            )

        return {
            **state,
            "design_review_report": report,
            "design_gaps":          report.get("gaps", []),
            "design_review_status": status,
            "safe_mode":            status == "fail",
            "current_agent":        "design_review",
        }
