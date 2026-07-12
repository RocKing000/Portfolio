from __future__ import annotations

from typing import Any

from ...shared.base_agent import BaseAgent, AgentContext
from ...shared.llm_gateway import ModelTier
from ..state import Component1State


SYSTEM_PROMPT = """You are the Data Discovery Agent for the SDLC Automation Suite.
Your role is to analyze raw client data (Excel or database schema) and produce:
1. A complete schema map (tables/sheets, columns, types, relationships)
2. A data quality report (missing values, anomalies, inconsistencies)
3. A raw data inventory (volume, patterns, distributions)

Rules:
- Never assume meaning — report what you observe, not what you infer
- Flag every anomaly, no matter how minor
- All output must be structured JSON
- Confidence scores (0.0-1.0) on every inference
"""


class DataDiscoveryAgent(BaseAgent):
    component = 1
    agent_name = "DataDiscoveryAgent"

    async def run(self, state: Component1State) -> Component1State:
        self._log.info("starting", iteration=state.get("iteration", 1))
        await self._emit_audit("AgentAction", {"action": "Started"})

        data_source = state.get("raw_data_source", {})

        prompt = f"""Analyze the following data source and produce a complete data discovery report.

Data Source Configuration:
{data_source}

Produce a JSON object with exactly these keys:
- schema_map: all tables/sheets with columns, types, nullability, and relationships
- data_quality_report: missing value rates, type inconsistencies, anomalous values, duplicates
- raw_data_inventory: row counts, column counts, value distributions, unique value counts

Be exhaustive. Every table and every column must appear in schema_map."""

        response = await self.llm_call(
            messages=[{"role": "user", "content": prompt}],
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.STANDARD,
            max_tokens=8192,
        )

        # Parse the structured response
        import json, re
        json_match = re.search(r"\{.*\}", response.content, re.DOTALL)
        parsed = json.loads(json_match.group()) if json_match else {}

        await self._emit_audit("AgentAction", {"action": "Completed",
                                               "output_keys": list(parsed.keys())})

        return {
            **state,
            "schema_map": parsed.get("schema_map", {}),
            "data_quality_report": parsed.get("data_quality_report", {}),
            "raw_data_inventory": parsed.get("raw_data_inventory", {}),
            "current_agent": self.agent_name,
        }

    def build_graph(self):
        raise NotImplementedError("DataDiscoveryAgent is a node, not a standalone graph.")
