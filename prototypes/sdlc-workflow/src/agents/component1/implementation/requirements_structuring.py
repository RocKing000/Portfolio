from __future__ import annotations

import json
import re

from ...shared.base_agent import BaseAgent
from ...shared.llm_gateway import ModelTier
from ..state import Component1State


SYSTEM_PROMPT = """You are the Requirements Structuring Agent for the SDLC Automation Suite.
You take the raw requirements list and impose structure, priority, and traceability.

Your outputs:
1. structured_requirements — priority-ranked list with inter-requirement dependencies
2. usge_slot_mapping — each requirement mapped to K (Constraints), I (Intent), or S (State Space)
3. traceability_matrix — requirement → source data field → goal served

USGE Slot Rules:
- K (Constraints): limits on what the system may do — security, compliance, hard limits
- I (Intent): what the client wants the system to achieve — goals, capabilities
- S (State Space): valid system states — data structures, statuses, transitions

Priority Rules (MoSCoW):
- MustHave: system fails without it, or legal/compliance requires it
- ShouldHave: high business value, significant impact if missing
- CouldHave: useful but not critical, easily deferred
- WontHave: explicitly out of scope for this iteration

Dependency Rules:
- A requirement that depends on another is blocked until the depended-upon is fulfilled
- Circular dependencies are a conflict — flag them
"""


class RequirementsStructuringAgent(BaseAgent):
    component = 1
    agent_name = "RequirementsStructuringAgent"

    async def run(self, state: Component1State) -> Component1State:
        self._log.info("starting")
        await self._emit_audit("AgentAction", {"action": "Started"})

        raw = state.get("raw_requirements", [])

        prompt = f"""Structure and prioritize the following raw requirements.

Raw Requirements ({len(raw)} items):
{json.dumps(raw, indent=2)}

Goal Hierarchy (for priority context):
{json.dumps(state.get("goal_hierarchy", {}), indent=2)}

Success Criteria (for MustHave determination):
{json.dumps(state.get("success_criteria", []), indent=2)}

Produce a JSON object with exactly these keys:

"structured_requirements": list of requirements, each with all original fields plus:
  - priority: MustHave|ShouldHave|CouldHave|WontHave
  - priority_rationale: one sentence explaining why
  - depends_on: list of requirement IDs this depends on
  - blocks: list of requirement IDs that cannot proceed until this is done
  - order_index: integer, implementation order (1 = first)

"usge_slot_mapping": list of objects with:
  - requirement_id, usge_slot (K|I|S), slot_rationale

"traceability_matrix": list of objects with:
  - requirement_id, source_data_fields (list), goal_ids (list), success_criteria_ids (list)

Flag any circular dependencies as items with priority WontHave and a note in priority_rationale."""

        response = await self.llm_call(
            messages=[{"role": "user", "content": prompt}],
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.PREMIUM,
            max_tokens=8192,
        )

        match = re.search(r"\{.*\}", response.content, re.DOTALL)
        parsed = json.loads(match.group()) if match else {}

        await self._emit_audit("AgentAction", {"action": "Completed"})

        return {
            **state,
            "structured_requirements": parsed.get("structured_requirements", []),
            "priority_ranking": parsed.get("structured_requirements", []),
            "traceability_matrix": parsed.get("traceability_matrix", []),
            "usge_slot_mapping": parsed.get("usge_slot_mapping", []),
            "current_agent": self.agent_name,
        }

    def build_graph(self):
        raise NotImplementedError
