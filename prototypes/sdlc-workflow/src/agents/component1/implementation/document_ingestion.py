from __future__ import annotations

import json
import re

from ...shared.base_agent import BaseAgent
from ...shared.llm_gateway import ModelTier
from ..state import Component1State


SYSTEM_PROMPT = """You are the Document Ingestion Agent for the SDLC Automation Suite.
You process plan documents uploaded by the client (DOCX or JSON) and extract structured changes.

Your job:
1. Compare the uploaded modified document against the original
2. Categorize every change: addition, modification, or removal
3. Validate each change against USGE constraints and previously approved items
4. Flag conflicts between the uploaded changes and already-approved decisions
5. Return a clean, validated change set ready for agent consumption

Rules:
- Changes to previously approved items require explicit re-approval — flag them
- Changes that violate USGE structural constraints are invalid — reject with reason
- You do not apply changes — you only validate and categorize them
- The client must confirm the diff is correct before changes are applied
"""


class DocumentIngestionAgent(BaseAgent):
    component = 1
    agent_name = "DocumentIngestionAgent"

    async def run(self, state: Component1State) -> Component1State:
        self._log.info("starting")
        await self._emit_audit("AgentAction", {"action": "Started"})

        uploaded_content = state.get("uploaded_plan_content", "")
        original_content = state.get("original_plan_content", "")

        if not uploaded_content:
            return {**state, "current_agent": self.agent_name,
                    "document_ingestion_result": {"status": "no_upload", "changes": []}}

        prompt = f"""Compare the original plan document against the client-uploaded modification.

Original Plan:
{original_content}

Client-Uploaded Modification:
{uploaded_content}

Previously Approved Items:
{json.dumps(state.get("approved_items", []), indent=2)}

Produce a JSON object with these keys:

"changes": list of changes detected, each with:
  - change_id, change_type (addition|modification|removal),
    location (section or requirement ID), original_value, new_value,
    affects_previously_approved (true/false),
    usge_valid (true/false), validation_reason

"conflicts": list of conflicts between uploaded changes and approved items:
  - conflict_description, affected_requirement_id, resolution_required

"validated_change_set": the subset of changes that are valid and not conflicting
  (ready to apply after client confirms diff)

"invalid_changes": changes rejected with reasons

"requires_reapproval": list of requirement IDs that need re-approval due to changes"""

        response = await self.llm_call(
            messages=[{"role": "user", "content": prompt}],
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=4096,
        )

        match = re.search(r"\{.*\}", response.content, re.DOTALL)
        parsed = json.loads(match.group()) if match else {}

        await self._emit_audit("AgentAction", {
            "action": "Completed",
            "changes_detected": len(parsed.get("changes", [])),
            "valid_changes": len(parsed.get("validated_change_set", [])),
            "conflicts": len(parsed.get("conflicts", [])),
        })

        return {
            **state,
            "document_ingestion_result": parsed,
            "current_agent": self.agent_name,
        }

    def build_graph(self):
        raise NotImplementedError
