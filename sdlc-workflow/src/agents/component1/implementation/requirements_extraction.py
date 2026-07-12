from __future__ import annotations

import json
import re

from ...shared.base_agent import BaseAgent
from ...shared.llm_gateway import ModelTier
from ..state import Component1State


SYSTEM_PROMPT = """You are the Requirements Extraction Agent for the SDLC Automation Suite.
Your job is to extract a complete, structured requirements list from validated research outputs.

You extract exactly four types:
- Functional (FR): what the system must do
- NonFunctional (NFR): how the system must perform (speed, security, scale, reliability)
- Constraint (CON): absolute limits the system must not violate
- Assumption (ASM): things accepted as true without proof, requiring client confirmation

Rules:
- Every requirement must trace to: a source data field OR a goal in the goal hierarchy
- No requirement can exist without a traceable origin
- Use IDs: FR-001, NFR-001, CON-001, ASM-001 with sequential numbering
- Standing approvals from the client apply — do not re-extract already-approved items
- Flag every item that depends on an unresolved assumption
"""


class RequirementsExtractionAgent(BaseAgent):
    component = 1
    agent_name = "RequirementsExtractionAgent"

    async def run(self, state: Component1State) -> Component1State:
        self._log.info("starting", iteration=state.get("iteration", 1))
        await self._emit_audit("AgentAction", {"action": "Started"})

        corrections = state.get("gate1_corrections", [])
        standing = state.get("standing_approvals", [])

        prompt = f"""Extract a complete requirements list from the validated research below.

Research Summary:
{json.dumps(state.get("research_summary", {}), indent=2)}

Goal Hierarchy:
{json.dumps(state.get("goal_hierarchy", {}), indent=2)}

Coverage Map:
{json.dumps(state.get("coverage_map", {}), indent=2)}

Client Corrections from Gate 1:
{json.dumps(corrections, indent=2)}

Standing Approvals (do not re-extract these):
{json.dumps(standing, indent=2)}

Produce a JSON object with key "requirements" — a list where each item has:
  id, type (Functional|NonFunctional|Constraint|Assumption),
  title, description,
  source_data (which field/table this traces to),
  goal_served (which goal ID this satisfies),
  derivation_basis (how you derived it),
  depends_on_assumption (list of ASM IDs, empty if none),
  confidence (0.0-1.0)

Be exhaustive. Every goal in the goal hierarchy must have at least one requirement."""

        response = await self.llm_call(
            messages=[{"role": "user", "content": prompt}],
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.PREMIUM,
            max_tokens=8192,
        )

        match = re.search(r"\{.*\}", response.content, re.DOTALL)
        parsed = json.loads(match.group()) if match else {"requirements": []}

        await self._emit_audit("AgentAction", {
            "action": "Completed",
            "requirements_count": len(parsed.get("requirements", [])),
        })

        return {
            **state,
            "raw_requirements": parsed.get("requirements", []),
            "current_agent": self.agent_name,
        }

    def build_graph(self):
        raise NotImplementedError
