from __future__ import annotations

import json
import re

from ...shared.base_agent import BaseAgent
from ...shared.llm_gateway import ModelTier
from ..state import Component1State


SYSTEM_PROMPT = """You are the Approval Agent for the SDLC Automation Suite.
You interpret client feedback from the Translation Agent and convert it into structured approval decisions.

Your job:
1. Parse the client's response (text or structured) into actionable decisions
2. Update the standing approval registry when client grants standing approvals
3. Determine which specific requirements are approved, rejected, or pending
4. Generate precise iteration instructions when items are rejected
5. Maintain the complete session audit trail entry for this approval event

Interpretation rules:
- "approve all" / "looks good" / "proceed" → full approval of all presented items
- Named rejections → only those specific items are rejected, rest are approved
- "I want to change X" → rejection of X with the requested change as correction
- "going forward, always approve X type" → standing approval for that class
- Partial responses → only the responded-to items are decided, rest remain pending

Iteration instructions must be surgical:
- Only list the specific agents that need to re-run
- Include the exact correction to apply
- Do not trigger a full restart for a single correction
"""


class ApprovalAgent(BaseAgent):
    component = 1
    agent_name = "ApprovalAgent"

    async def run(self, state: Component1State) -> Component1State:
        self._log.info("starting")
        await self._emit_audit("AgentAction", {"action": "Started"})

        client_feedback = state.get("client_feedback", "")
        translated = state.get("translated_output", {})
        gate = self._current_gate(state)

        prompt = f"""Interpret the following client feedback and produce structured approval decisions.

Current Gate: {gate}
Client Feedback: \"\"\"{client_feedback}\"\"\"

Presented Content (what client reviewed):
{json.dumps(translated.get("presentation", {}), indent=2)}

Current Unresolved Conflicts:
{json.dumps(state.get("unresolved_conflicts", []), indent=2)}

Current Standing Approvals:
{json.dumps(state.get("standing_approvals", []), indent=2)}

Produce a JSON object with exactly these keys:

"gate_decision": one of: approved | rejected | partial | pending
"approved_items": list of requirement IDs explicitly or implicitly approved
"rejected_items": list of objects with requirement_id and rejection_reason
"conflict_decisions": list of objects with conflict_id and chosen_option (a|b|custom) and custom_decision if any
"new_standing_approvals": list of new standing approval classes granted this round
"iteration_instructions": list of objects with:
  agent_name, correction, applies_to_requirement_ids
  (only populated if gate_decision is rejected or partial)
"gate_resolved": which gate this resolves (gate1|gate2|gate3|gate4)
"audit_entry": plain-language summary of this approval event for the audit trail"""

        response = await self.llm_call(
            messages=[{"role": "user", "content": prompt}],
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=4096,
        )

        match = re.search(r"\{.*\}", response.content, re.DOTALL)
        parsed = json.loads(match.group()) if match else {}

        decision = parsed.get("gate_decision", "pending")
        gate_resolved = parsed.get("gate_resolved", gate)
        new_standing = parsed.get("new_standing_approvals", [])

        # Update standing approvals in state
        existing_standing = list(state.get("standing_approvals", []))
        existing_standing.extend(new_standing)

        # Update gate flags
        gate1_approved = state.get("gate1_approved", False)
        gate2_approved = state.get("gate2_approved", False)
        gate3_approved = state.get("gate3_approved", False)
        gate4_approved = state.get("gate4_approved", False)

        if decision == "approved":
            if gate_resolved == "gate1":
                gate1_approved = True
            elif gate_resolved == "gate2":
                gate2_approved = True
            elif gate_resolved == "gate3":
                gate3_approved = True
                # Apply conflict decisions
                unresolved = state.get("unresolved_conflicts", [])
                conflict_map = {d["conflict_id"]: d for d in parsed.get("conflict_decisions", [])}
                remaining = [c for c in unresolved if c["conflict_id"] not in conflict_map]
                state = {**state, "unresolved_conflicts": remaining}
            elif gate_resolved == "gate4":
                gate4_approved = True

        await self._emit_audit("AgentAction", {
            "action": "Completed",
            "gate": gate_resolved,
            "decision": decision,
            "new_standing_approvals": len(new_standing),
        })

        return {
            **state,
            "gate1_approved": gate1_approved,
            "gate2_approved": gate2_approved,
            "gate3_approved": gate3_approved,
            "gate4_approved": gate4_approved,
            "approval_decision": parsed,
            "standing_approvals": existing_standing,
            "iteration_instructions": parsed.get("iteration_instructions", []),
            "current_agent": self.agent_name,
        }

    def _current_gate(self, state: Component1State) -> str:
        if not state.get("gate1_approved"):
            return "gate1"
        if not state.get("gate2_approved"):
            return "gate2"
        if state.get("unresolved_conflicts"):
            return "gate3"
        return "gate4"

    def build_graph(self):
        raise NotImplementedError
