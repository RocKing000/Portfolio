from __future__ import annotations

import json
import re

from ...shared.base_agent import BaseAgent
from ...shared.llm_gateway import ModelTier
from ..state import Component1State


SYSTEM_PROMPT = """You are the Semantic Analysis Agent for the SDLC Automation Suite.
Your role is to interpret the real-world meaning of data discovered by the Data Discovery Agent.

You produce:
1. entity_map: real-world entities in the data, their relationships and properties
2. business_term_glossary: what each field likely means, with confidence score per inference
3. semantic_uncertainty_report: what could not be confidently inferred

Rules:
- Separate what you KNOW (from field names/types) from what you INFER (from context)
- Every inference must have a confidence score (0.0-1.0)
- Low confidence (<0.7) must appear in semantic_uncertainty_report
- Never invent meaning — flag uncertainty instead
"""


class SemanticAnalysisAgent(BaseAgent):
    component = 1
    agent_name = "SemanticAnalysisAgent"

    async def run(self, state: Component1State) -> Component1State:
        self._log.info("starting")
        await self._emit_audit("AgentAction", {"action": "Started"})

        prompt = f"""Given the schema map and data inventory below, produce a semantic analysis.

Schema Map:
{json.dumps(state.get("schema_map", {}), indent=2)}

Data Inventory:
{json.dumps(state.get("raw_data_inventory", {}), indent=2)}

Produce a JSON object with exactly these keys:
- entity_map: real-world entities, their attributes (mapped from columns), relationships
- business_term_glossary: per-field entry with field_name, inferred_meaning, confidence, evidence
- semantic_uncertainty_report: list of fields/entities with uncertainty_reason and confidence"""

        response = await self.llm_call(
            messages=[{"role": "user", "content": prompt}],
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=8192,
        )

        json_match = re.search(r"\{.*\}", response.content, re.DOTALL)
        parsed = json.loads(json_match.group()) if json_match else {}

        await self._emit_audit("AgentAction", {"action": "Completed"})

        return {
            **state,
            "entity_map": parsed.get("entity_map", {}),
            "business_term_glossary": parsed.get("business_term_glossary", []),
            "semantic_uncertainty_report": parsed.get("semantic_uncertainty_report", {}),
            "current_agent": self.agent_name,
        }

    def build_graph(self):
        raise NotImplementedError
