"""
DesignPackageAssembly Agent — Component 2, UI/UX Design Layer (Agent 6/7)

Assembles all UI/UX artefacts into the complete design package that will be:
1. Stored in MinIO as a DOCX
2. Sent to the internal review queue
3. Presented to the client for Gate 3 approval
4. Handed off to Component 3 for implementation
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a design lead assembling the final design handoff package for engineers and clients.

Return JSON:
{
  "design_package": {
    "title": "<Project> Design Package v1.0",
    "figma_url": "<url>",
    "summary_for_client": "<non-technical 3-paragraph summary of what was designed>",
    "summary_for_engineers": "<technical 3-paragraph summary emphasising component library, API consumption, and state management>",
    "screen_inventory": [
      {"id": "SCR-001", "name": "<name>", "route": "<route>", "status": "designed"}
    ],
    "component_inventory": [
      {"id": "DS-001", "name": "<name>", "variants": 3, "documented": true}
    ],
    "handoff_notes": [
      {"section": "<screen or component>", "note": "<implementation guidance>"}
    ],
    "open_items": ["<anything not yet finalised>"],
    "acceptance_criteria_for_client": [
      "All screens match agreed user journeys",
      "Accessibility meets WCAG AA"
    ]
  }
}
"""


class DesignPackageAssemblyAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Assemble the final design handoff package.

FIGMA URL: {state.get('figma_file_url', 'pending')}

SCREENS: {len(state.get('screen_designs', []))} screens designed
COMPONENTS: {len(state.get('component_catalogue', []))} components specified
FLOWS: {len(state.get('interaction_flows', []))} interaction flows

DESIGN REVIEW STATUS: {state.get('design_review_status', 'conditional_pass')}
GAPS: {json.dumps(state.get('design_gaps', []), indent=2)}

TECH STACK: {json.dumps(state.get('tech_stack', {}), indent=2)}

Produce the complete design package for Gate 3 client review and C3 handoff."""
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
            result = {"raw_package": response.content}

        package = result.get("design_package", result)

        # Add full UX artefacts into package for MinIO storage
        package["uiux_artefacts"] = {
            "figma_workspace_plan": state.get("figma_workspace_plan"),
            "design_tokens":        state.get("design_tokens"),
            "design_system_spec":   state.get("design_system_spec"),
            "screen_designs":       state.get("screen_designs"),
            "interaction_flows":    state.get("interaction_flows"),
            "micro_interactions":   state.get("micro_interactions"),
            "form_validation_rules": state.get("form_validation_rules"),
        }

        logger.info("DesignPackageAssembly complete")

        # Queue for internal review
        await self.publish_plan_for_review(
            plan_minio_key=f"sessions/{state.get('session_id')}/design_package.json",
            context_summary=package.get("summary_for_engineers", ""),
            priority="normal",
            review_type="design",
        )

        return {
            **state,
            "design_package":   package,
            "current_agent":    "design_package_assembly",
        }
