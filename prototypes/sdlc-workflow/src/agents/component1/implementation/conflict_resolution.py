from __future__ import annotations

import json
import re

from ...shared.base_agent import BaseAgent
from ...shared.llm_gateway import ModelTier
from ..state import Component1State


SYSTEM_PROMPT = """You are the Conflict Resolution Agent for the SDLC Automation Suite.
You identify conflicts between requirements and resolve what you can. What you cannot resolve, you escalate.

Conflict types you detect:
- Contradiction: two requirements demand mutually exclusive things
- Dependency conflict: a requirement depends on another that contradicts it
- Priority conflict: two MustHave requirements cannot both be implemented first
- Scope conflict: a requirement contradicts an explicit constraint or assumption
- Resource conflict: two requirements compete for the same limited resource/component

Auto-resolution rules (you may resolve these without client):
- Priority conflicts: promote lower-priority item, defer to next iteration
- Scope conflict where constraint is from a standing approval: constraint wins
- Minor wording inconsistencies with clear intent: normalize to clearest wording

Escalation rules (always escalate — never auto-resolve):
- Any conflict that changes the meaning of a requirement
- Any conflict touching client-provided data or expected outcome
- Any conflict where both items are MustHave
- Any conflict you have less than 0.85 confidence resolving correctly
"""


class ConflictResolutionAgent(BaseAgent):
    component = 1
    agent_name = "ConflictResolutionAgent"

    async def run(self, state: Component1State) -> Component1State:
        self._log.info("starting")
        await self._emit_audit("AgentAction", {"action": "Started"})

        structured = state.get("structured_requirements", [])
        known_conflicts = state.get("conflict_report", [])

        prompt = f"""Identify and resolve conflicts in the structured requirements below.

Structured Requirements:
{json.dumps(structured, indent=2)}

Known Conflicts from Research Layer:
{json.dumps(known_conflicts, indent=2)}

Standing Approvals (constraint wins if conflict involves these):
{json.dumps(state.get("standing_approvals", []), indent=2)}

Produce a JSON object with exactly these keys:

"auto_resolved_conflicts": list of conflicts you resolved, each with:
  - conflict_id (CON-RES-001 etc), conflict_type, description,
    requirements_involved (list of IDs), resolution_applied,
    resolution_rationale, authority (always "Agent"),
    updated_requirement_ids (list of IDs changed by this resolution)

"unresolved_conflicts": conflicts requiring client decision, each with:
  - conflict_id (CON-ESC-001 etc), conflict_type, description,
    requirements_involved (list of IDs),
    option_a (description + consequence),
    option_b (description + consequence),
    agent_recommendation (a|b|neither),
    recommendation_rationale

"updated_requirements": the full requirements list with auto-resolutions applied.
  Only include requirements changed by auto-resolution — merge with originals."""

        response = await self.llm_call(
            messages=[{"role": "user", "content": prompt}],
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.PREMIUM,
            max_tokens=8192,
        )

        match = re.search(r"\{.*\}", response.content, re.DOTALL)
        parsed = json.loads(match.group()) if match else {}

        # Merge auto-resolution updates back into structured requirements
        updated_map = {r["id"]: r for r in parsed.get("updated_requirements", [])}
        merged = [updated_map.get(r["id"], r) for r in structured]

        await self._emit_audit("AgentAction", {
            "action": "Completed",
            "auto_resolved": len(parsed.get("auto_resolved_conflicts", [])),
            "escalated": len(parsed.get("unresolved_conflicts", [])),
        })

        return {
            **state,
            "structured_requirements": merged,
            "auto_resolved_conflicts": parsed.get("auto_resolved_conflicts", []),
            "unresolved_conflicts": parsed.get("unresolved_conflicts", []),
            "current_agent": self.agent_name,
        }

    def build_graph(self):
        raise NotImplementedError
