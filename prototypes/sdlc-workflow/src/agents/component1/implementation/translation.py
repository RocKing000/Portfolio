from __future__ import annotations

import json
import re

from ...shared.base_agent import BaseAgent
from ...shared.llm_gateway import ModelTier
from ..state import Component1State


SYSTEM_PROMPT = """You are the Translation Agent for the SDLC Automation Suite.
You translate internal structured outputs into language appropriate for the specific user you are addressing.

You never expose:
- Internal agent names or component numbers
- USGE terminology (State Space, Constraints K, Intent I) to non-technical users
- Raw JSON structures
- System-internal IDs unless the user is technical

User roles and their language level:
- Client / Business Owner: plain business language, no technical jargon, focus on outcomes
- Business Analyst: business domain language, can handle structured requirements format
- Technical roles (TechLead, Architect, Developer): full technical detail acceptable

You also:
- Interpret incoming user feedback into normalized internal decisions
- Identify standing approvals the user is granting
- Identify partial approvals (some requirements approved, others rejected)
- Surface escalated conflicts in plain language with clear options

Session user model: track how this specific user communicates and adapt.
"""


class TranslationAgent(BaseAgent):
    component = 1
    agent_name = "TranslationAgent"

    async def run(self, state: Component1State) -> Component1State:
        self._log.info("starting", gate=self._current_gate(state))
        await self._emit_audit("AgentAction", {"action": "Started"})

        gate = self._current_gate(state)
        user_role = state.get("user_role", "Client")

        if gate == "gate1":
            content = self._build_gate1_content(state)
            gate_label = "Research Review"
        elif gate == "gate2":
            content = self._build_gate2_content(state)
            gate_label = "Requirements Review"
        elif gate == "gate3":
            content = self._build_conflict_escalation_content(state)
            gate_label = "Conflict Resolution"
        else:
            content = self._build_gate4_content(state)
            gate_label = "Final Approval"

        prompt = f"""Translate the following structured content for a user with role: {user_role}.

Gate: {gate_label}
Content to translate:
{content}

Unresolved conflicts requiring client decision:
{json.dumps(state.get("unresolved_conflicts", []), indent=2)}

Produce a JSON object with these keys:
"presentation": the translated content as a human-readable structured object
  (sections with plain-language titles and bullet-point content)
"conflict_questions": list of plain-language questions for each unresolved conflict,
  each with: conflict_id, question, option_a_plain, option_b_plain, recommendation_plain
"session_user_model_update": observations about how this user communicates
  (vocabulary level, detail preference, domain familiarity)"""

        response = await self.llm_call(
            messages=[{"role": "user", "content": prompt}],
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=4096,
        )

        match = re.search(r"\{.*\}", response.content, re.DOTALL)
        parsed = json.loads(match.group()) if match else {}

        await self._emit_audit("AgentAction", {"action": "Completed", "gate": gate})

        return {
            **state,
            "translated_output": parsed,
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

    def _build_gate1_content(self, state: Component1State) -> str:
        return json.dumps({
            "research_summary": state.get("research_summary", {}),
            "assumption_log": state.get("assumption_log", []),
            "coverage_map": state.get("coverage_map", {}),
            "conflict_report": state.get("conflict_report", []),
        }, indent=2)

    def _build_gate2_content(self, state: Component1State) -> str:
        reqs = state.get("structured_requirements", [])
        must_have = [r for r in reqs if r.get("priority") == "MustHave"]
        should_have = [r for r in reqs if r.get("priority") == "ShouldHave"]
        return json.dumps({
            "total_requirements": len(reqs),
            "must_have": must_have,
            "should_have": should_have,
            "traceability_summary": f"{len(reqs)} requirements traced to {len(state.get('goal_hierarchy', {}).get('goals', []))} goals",
        }, indent=2)

    def _build_conflict_escalation_content(self, state: Component1State) -> str:
        return json.dumps({
            "unresolved_conflicts": state.get("unresolved_conflicts", []),
            "auto_resolved_count": len(state.get("auto_resolved_conflicts", [])),
        }, indent=2)

    def _build_gate4_content(self, state: Component1State) -> str:
        reqs = state.get("structured_requirements", [])
        return json.dumps({
            "total_requirements": len(reqs),
            "by_priority": {
                "MustHave": len([r for r in reqs if r.get("priority") == "MustHave"]),
                "ShouldHave": len([r for r in reqs if r.get("priority") == "ShouldHave"]),
                "CouldHave": len([r for r in reqs if r.get("priority") == "CouldHave"]),
            },
            "assumptions_confirmed": len([a for a in state.get("assumption_log", []) if a.get("client_confirmed")]),
            "conflicts_resolved": len(state.get("auto_resolved_conflicts", [])),
        }, indent=2)

    def build_graph(self):
        raise NotImplementedError
