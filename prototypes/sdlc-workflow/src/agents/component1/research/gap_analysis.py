from __future__ import annotations

import json
import re

from ...shared.base_agent import BaseAgent
from ...shared.llm_gateway import ModelTier
from ..state import Component1State


SYSTEM_PROMPT = """You are the Gap Analysis Agent for the SDLC Automation Suite.
You synthesize ALL research outputs and produce the final research summary for client review.

You produce:
1. coverage_map: which goals are fully/partially/not supported by available data
2. conflict_report: data conflicts with outcome, internal data conflicts
3. assumption_log: every assumption made by any research agent, with basis and confidence
4. research_summary: complete structured picture for Approval Gate 1

Rules:
- Consolidate ALL assumptions from ALL prior agents into assumption_log
- Every conflict must have: conflict_type, involved_parties, description, resolution_options
- Coverage must be per-goal: coverage_level (full/partial/none), supporting_data, gaps
"""


class GapAnalysisAgent(BaseAgent):
    component = 1
    agent_name = "GapAnalysisAgent"

    async def run(self, state: Component1State) -> Component1State:
        self._log.info("starting")
        await self._emit_audit("AgentAction", {"action": "Started"})

        prompt = f"""Synthesize the research outputs below into a gap analysis and research summary.

Entity Map: {json.dumps(state.get("entity_map", {}), indent=2)}
Business Term Glossary (first 10): {json.dumps(state.get("business_term_glossary", [])[:10], indent=2)}
Semantic Uncertainty: {json.dumps(state.get("semantic_uncertainty_report", {}), indent=2)}
Goal Hierarchy: {json.dumps(state.get("goal_hierarchy", {}), indent=2)}
Success Criteria: {json.dumps(state.get("success_criteria", []), indent=2)}
Constraint Inference: {json.dumps(state.get("constraint_inference", []), indent=2)}
Data Quality Issues: {json.dumps(state.get("data_quality_report", {}).get("issues", []), indent=2)}

Produce a JSON object with exactly these keys:
- coverage_map: per-goal coverage analysis
- conflict_report: all conflicts found
- assumption_log: all assumptions from all agents consolidated
- research_summary: executive summary ready for client at Gate 1"""

        response = await self.llm_call(
            messages=[{"role": "user", "content": prompt}],
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.PREMIUM,
            max_tokens=8192,
        )

        json_match = re.search(r"\{.*\}", response.content, re.DOTALL)
        parsed = json.loads(json_match.group()) if json_match else {}

        await self._emit_audit("AgentAction", {"action": "Completed"})

        return {
            **state,
            "coverage_map": parsed.get("coverage_map", {}),
            "conflict_report": parsed.get("conflict_report", []),
            "assumption_log": parsed.get("assumption_log", []),
            "research_summary": parsed.get("research_summary", {}),
            "current_agent": self.agent_name,
        }

    def build_graph(self):
        raise NotImplementedError
