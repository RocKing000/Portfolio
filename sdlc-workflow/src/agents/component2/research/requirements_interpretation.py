"""
RequirementsInterpretation Agent — Component 2, Research Layer (Agent 1/7)

Translates the Component 1 requirements package into design-ready specifications.
Extracts design constraints, identifies ambiguities, and establishes design principles.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a senior solution architect interpreting a finalized requirements package
and extracting design-relevant insights. Your job is to bridge requirements → design.

Your output must be a JSON object with:
{
  "design_constraints": [
    {
      "id": "DC-001",
      "source_requirement": "<requirement ID>",
      "constraint_type": "technical|security|performance|regulatory|ux",
      "description": "<precise constraint that design must honour>",
      "impact_areas": ["architecture", "data_model", "api", "ui_ux"]
    }
  ],
  "non_negotiables": ["<absolute must-have design decisions>"],
  "design_principles": [
    {"principle": "<name>", "rationale": "<why this applies>", "trade_off": "<what it sacrifices>"}
  ],
  "ambiguities": [
    {"id": "AMB-001", "description": "<unclear requirement>", "proposed_resolution": "<assumption>", "risk": "low|medium|high"}
  ],
  "technology_hints": {
    "frontend_paradigm": "<SPA|MPA|hybrid|mobile-first>",
    "backend_paradigm": "<REST|GraphQL|gRPC|event-driven>",
    "data_paradigm": "<relational|document|graph|time-series|mixed>",
    "ai_required": true,
    "realtime_required": false
  },
  "quality_attributes": {
    "scalability": "<requirement and rationale>",
    "availability": "<target SLA>",
    "security_posture": "<basic|standard|hardened|zero-trust>",
    "maintainability": "<modular|monolith|microservices>"
  }
}
"""


class RequirementsInterpretationAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError("Use run() directly — this agent is a single-step node")

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        requirements_package = state.get("requirements_package", {})
        session_id = state.get("session_id", "")

        messages = [
            {
                "role": "user",
                "content": f"""Interpret this requirements package and produce design specifications.

REQUIREMENTS PACKAGE:
{json.dumps(requirements_package, indent=2)}

Operating Mode: {state.get('operating_mode', 'HITL')}

Focus on:
1. What design constraints does each requirement impose?
2. Which requirements have ambiguous design implications?
3. What technology paradigms does this imply?
4. What quality attributes must the design achieve?"""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.PREMIUM,
            max_tokens=4096,
        )

        try:
            interpretation = json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("RequirementsInterpretation: JSON parse failed, wrapping raw")
            interpretation = {"raw_interpretation": response.content}

        logger.info("RequirementsInterpretation complete: %d constraints, %d ambiguities",
                    len(interpretation.get("design_constraints", [])),
                    len(interpretation.get("ambiguities", [])))

        return {
            **state,
            "design_constraints":   interpretation.get("design_constraints", []),
            "non_negotiables":      interpretation.get("non_negotiables", []),
            "design_principles":    interpretation.get("design_principles", []),
            "design_ambiguities":   interpretation.get("ambiguities", []),
            "technology_hints":     interpretation.get("technology_hints", {}),
            "quality_attributes":   interpretation.get("quality_attributes", {}),
            "current_agent":        "requirements_interpretation",
        }
