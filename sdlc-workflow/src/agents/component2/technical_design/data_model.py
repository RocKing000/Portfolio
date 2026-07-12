"""
DataModel Agent — Component 2, Technical Design Layer (Agent 3/6)

Produces the logical data model: entities, relationships, indexes,
partitioning strategy, and migration plan.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are a data architect designing the logical data model.

Return JSON:
{
  "entities": [
    {
      "id": "ENT-001",
      "name": "<entity name>",
      "description": "<what it represents>",
      "attributes": [
        {
          "name": "<column>",
          "type": "<string|uuid|integer|decimal|boolean|datetime|json|blob>",
          "nullable": false,
          "unique": false,
          "indexed": true,
          "description": "<purpose>"
        }
      ],
      "primary_key": "<attribute name>",
      "natural_key": "<business identifier if any>",
      "audit_fields": ["created_at", "updated_at", "created_by"]
    }
  ],
  "relationships": [
    {
      "from_entity": "ENT-001",
      "to_entity": "ENT-002",
      "cardinality": "one_to_many|many_to_many|one_to_one",
      "foreign_key": "<column>",
      "cascade": "none|delete|nullify"
    }
  ],
  "database_strategy": {
    "primary_db": "<technology>",
    "sharding": false,
    "partitioning": "<by date|by tenant|none>",
    "read_replicas": false,
    "caching_layer": "<Redis|Memcached|none>",
    "search_engine": "<Elasticsearch|none>"
  },
  "indexes": [
    {"entity": "ENT-001", "columns": ["col1", "col2"], "type": "composite|unique|partial", "rationale": "<why>"}
  ],
  "migration_strategy": {
    "approach": "flyway|liquibase|manual|orm",
    "backwards_compatible": true,
    "zero_downtime": true
  }
}
"""


class DataModelAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [
            {
                "role": "user",
                "content": f"""Design the logical data model for this system.

REQUIREMENTS:
{json.dumps(state.get('requirements_package', {}).get('functional_requirements', [])[:15], indent=2)}

SERVICES:
{json.dumps([{'id': s.get('id'), 'name': s.get('name'), 'responsibility': s.get('responsibility')}
             for s in state.get('services', [])], indent=2)}

DATA PARADIGM: {state.get('technology_hints', {}).get('data_paradigm', 'relational')}

QUALITY ATTRIBUTES:
{json.dumps(state.get('quality_attributes', {}), indent=2)}

Produce a complete logical data model with entities, relationships, indexes, and migration strategy."""
            }
        ]

        response = await self.llm_call(
            messages=messages,
            system=SYSTEM_PROMPT,
            model_tier=ModelTier.PREMIUM,
            max_tokens=6000,
        )

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            result = {"raw_data_model": response.content}

        logger.info("DataModel complete: %d entities, %d relationships",
                    len(result.get("entities", [])),
                    len(result.get("relationships", [])))

        return {
            **state,
            "data_model":        result,
            "entities":          result.get("entities", []),
            "relationships":     result.get("relationships", []),
            "database_strategy": result.get("database_strategy", {}),
            "current_agent":     "data_model",
        }
