from __future__ import annotations

import json
import re

from ...shared.base_agent import BaseAgent
from ...shared.llm_gateway import ModelTier
from ..state import Component1State


SYSTEM_PROMPT = """You are the Outcome Analysis Agent for the SDLC Automation Suite.
You analyze the client's stated expected outcome and extract structured goals.

You produce:
1. goal_hierarchy: primary goals, sub-goals, dependencies between goals
2. success_criteria: measurable conditions that define success, with acceptance thresholds
3. constraint_inference: implied constraints from the outcome statement, with confidence scores

Rules:
- Work only from what the client stated — do not add goals they did not imply
- Measurable means testable — every success criterion must be verifiable
- Flag ambiguous outcome statements in constraint_inference with confidence < 0.7
"""


class OutcomeAnalysisAgent(BaseAgent):
    component = 1
    agent_name = "OutcomeAnalysisAgent"

    async def run(self, state: Component1State) -> Component1State:
        self._log.info("starting")
        await self._emit_audit("AgentAction", {"action": "Started"})

        prompt = f"""Analyze the following expected outcome statement.

Expected Outcome (client-provided):
\"\"\"{state.get("expected_outcome", "")}\"\"\"

Produce a JSON object with exactly these keys:
- goal_hierarchy: list of goals, each with id, type (primary/sub), description, parent_id, dependencies
- success_criteria: list of criteria, each with id, description, measurement_method, acceptance_threshold
- constraint_inference: list of inferred constraints, each with description, confidence, source_phrase"""

        response = await self.llm_call(
            messages=[{"role": "user", "content": prompt}],
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=4096,
        )

        json_match = re.search(r"\{.*\}", response.content, re.DOTALL)
        parsed = json.loads(json_match.group()) if json_match else {}

        await self._emit_audit("AgentAction", {"action": "Completed"})

        return {
            **state,
            "goal_hierarchy": parsed.get("goal_hierarchy", {}),
            "success_criteria": parsed.get("success_criteria", []),
            "constraint_inference": parsed.get("constraint_inference", []),
            "current_agent": self.agent_name,
        }

    def build_graph(self):
        raise NotImplementedError
