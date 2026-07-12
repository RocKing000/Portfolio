"""
RiskAnalysis Agent — Component 2, Research Layer (Agent 7/7)

Produces the research-layer risk register that feeds into Gate 1 review.
Consolidates all risks from feasibility, integration, and architecture.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a risk manager consolidating all design risks identified in the research phase.
Produce a comprehensive risk register and prioritised mitigation plan.

Return JSON:
{
  "risk_register": [
    {
      "id": "RISK-001",
      "category": "technical|schedule|integration|security|ux|data|compliance",
      "title": "<short risk title>",
      "description": "<precise risk description>",
      "probability": "low|medium|high",
      "impact": "low|medium|high",
      "risk_score": 1-9,
      "source": "<which agent or analysis surfaced this>",
      "mitigation": "<specific mitigation action>",
      "owner": "<role responsible: SolutionArchitect|TechLead|UIUXLead|etc>",
      "residual_risk": "low|medium|high"
    }
  ],
  "top_5_risks": ["RISK-001", "RISK-002", "RISK-003", "RISK-004", "RISK-005"],
  "risk_summary": "<2-3 sentence executive summary of the risk landscape>",
  "go_no_go_recommendation": {
    "decision": "go|conditional_go|no_go",
    "conditions": ["<condition that must be met if conditional_go>"],
    "rationale": "<why>"
  }
}
"""


class RiskAnalysisAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Consolidate all risks from the research phase into a risk register.

TECHNICAL RISKS (from feasibility):
{json.dumps(state.get('technical_risks', []), indent=2)}

INTEGRATION RISKS:
{json.dumps(state.get('integration_risks', []), indent=2)}

FEASIBILITY BLOCKERS:
{json.dumps(state.get('feasibility_blockers', []), indent=2)}

DESIGN AMBIGUITIES:
{json.dumps(state.get('design_ambiguities', []), indent=2)}

OVERALL FEASIBILITY: {state.get('feasibility_assessment', {}).get('overall_feasibility', 'unknown')}

Produce a complete risk register, identify top 5 risks, and recommend go/no-go."""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=4096,
        )

        try:
            risks = json.loads(response.content)
        except json.JSONDecodeError:
            risks = {"raw_risks": response.content}

        go_decision = risks.get("go_no_go_recommendation", {}).get("decision", "conditional_go")
        logger.info("RiskAnalysis complete: %d risks, go/no-go=%s",
                    len(risks.get("risk_register", [])), go_decision)

        # Trigger safe mode if no-go
        if go_decision == "no_go":
            await self.enter_safe_mode(
                reason=f"Risk analysis produced NO-GO: {risks.get('go_no_go_recommendation', {}).get('rationale')}"
            )

        return {
            **state,
            "risk_register":        risks.get("risk_register", []),
            "top_risks":            risks.get("top_5_risks", []),
            "risk_summary":         risks.get("risk_summary", ""),
            "go_no_go":             go_decision,
            "go_conditions":        risks.get("go_no_go_recommendation", {}).get("conditions", []),
            "safe_mode":            go_decision == "no_go",
            "current_agent":        "risk_analysis",
        }
