"""Component 3 — Database layer agents (7 agents)."""
from __future__ import annotations

from shared.llm_gateway.base import ModelTier
from ..base_spec_agent import LayerSpecAgent

_DB_CONTEXT = ["design_package", "implementation_context", "dependency_map"]


class DBSchemaAnalysisAgent(LayerSpecAgent):
    AGENT_NAME = "db_schema_analysis"
    OUTPUT_KEY = "db_schema_analysis"
    MODEL_TIER = ModelTier.PREMIUM
    INPUT_KEYS = _DB_CONTEXT
    SYSTEM_PROMPT = """
Analyse the data model from the design package and produce a database schema analysis.

Return JSON:
{
  "tables": [
    {"name": "", "purpose": "", "estimated_rows": "low|medium|high|very_high",
     "columns": [{"name": "", "type": "", "nullable": false, "pk": false, "fk": null, "unique": false, "indexed": false}],
     "constraints": ["<constraint>"],
     "partitioning_needed": false}
  ],
  "views_needed": [{"name": "", "purpose": "", "base_tables": []}],
  "triggers_needed": [{"name": "", "event": "INSERT|UPDATE|DELETE", "purpose": ""}],
  "schema_complexity": "low|medium|high",
  "normalisation_form": "2NF|3NF|BCNF|denormalised"
}
"""


class DBSchemaSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "db_schema_specification"
    OUTPUT_KEY = "db_schema_spec"
    MODEL_TIER = ModelTier.PREMIUM
    INPUT_KEYS = ["db_schema_analysis", "dependency_map"]
    MAX_TOKENS = 8000
    SYSTEM_PROMPT = """
Write the complete SQL DDL schema specification. Return JSON:
{
  "ddl_statements": [
    {"order": 1, "object_type": "TABLE|VIEW|TRIGGER|SEQUENCE|TYPE",
     "name": "", "sql": "<complete CREATE statement>", "rationale": ""}
  ],
  "database_name": "",
  "schema_name": "dbo",
  "charset": "UTF-8",
  "collation": "SQL_Latin1_General_CP1_CI_AS"
}
"""


class DBMigrationSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "db_migration_specification"
    OUTPUT_KEY = "db_migration_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["db_schema_spec", "dependency_map"]
    SYSTEM_PROMPT = """
Produce the database migration plan. Return JSON:
{
  "migration_tool": "Flyway|Liquibase|manual",
  "migrations": [
    {"version": "V001__", "name": "", "type": "DDL|DML|seed",
     "up_sql": "<migration SQL>", "down_sql": "<rollback SQL>",
     "is_breaking": false, "requires_downtime": false}
  ],
  "rollback_strategy": "<approach>",
  "zero_downtime_approach": "<technique>"
}
"""


class DBIndexSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "db_index_specification"
    OUTPUT_KEY = "db_index_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["db_schema_spec", "implementation_context"]
    SYSTEM_PROMPT = """
Design the index strategy. Return JSON:
{
  "indexes": [
    {"name": "", "table": "", "columns": [], "type": "NONCLUSTERED|CLUSTERED|UNIQUE|FILTERED|FULLTEXT",
     "include_columns": [], "filter_predicate": null,
     "rationale": "<query pattern this supports>",
     "estimated_size": "small|medium|large"}
  ],
  "index_maintenance": {"rebuild_frequency": "weekly|monthly", "statistics_update": "auto|manual"}
}
"""


class DBStoredProcSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "db_stored_proc_specification"
    OUTPUT_KEY = "db_stored_proc_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["db_schema_spec", "implementation_context"]
    SYSTEM_PROMPT = """
Specify stored procedures and functions needed. Return JSON:
{
  "stored_procedures": [
    {"name": "", "purpose": "", "parameters": [{"name": "", "type": "", "direction": "IN|OUT|INOUT"}],
     "returns": "", "sql_body": "<procedure SQL>", "called_by": "<service or component>"}
  ],
  "functions": [
    {"name": "", "purpose": "", "sql_body": "", "is_deterministic": true}
  ],
  "rationale": "<why stored procs are used or 'none needed'>"
}
"""


class DBSeedDataSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "db_seed_data_specification"
    OUTPUT_KEY = "db_seed_data_spec"
    MODEL_TIER = ModelTier.ECONOMY
    INPUT_KEYS = ["db_schema_spec", "implementation_context"]
    SYSTEM_PROMPT = """
Produce seed data specifications for reference data and dev environment. Return JSON:
{
  "seed_files": [
    {"order": 1, "table": "", "environment": "all|dev|test",
     "rows": [{"<col>": "<value>"}],
     "purpose": "reference_data|test_data|demo_data"}
  ],
  "sensitive_data_policy": "<how PII in seeds is handled>"
}
"""


class DBCodeGenerationAgent(LayerSpecAgent):
    """Produces the complete DB package summary for handoff to backend agents."""
    AGENT_NAME = "db_code_generation"
    OUTPUT_KEY = "database_package"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["db_schema_spec", "db_migration_spec", "db_index_spec",
                  "db_stored_proc_spec", "db_seed_data_spec"]
    SYSTEM_PROMPT = """
Assemble the complete database layer package. Return JSON:
{
  "database_package": {
    "schema_spec":      "<reference to db_schema_spec>",
    "migration_plan":   "<reference to db_migration_spec>",
    "index_strategy":   "<reference to db_index_spec>",
    "stored_procs":     "<reference to db_stored_proc_spec>",
    "seed_data":        "<reference to db_seed_data_spec>",
    "connection_pool":  {"min": 5, "max": 20, "timeout_ms": 3000},
    "orm_mapping":      "<how ORM/Dapper maps to schema>",
    "ready_for_backend": true
  }
}
"""

    async def run(self, state):
        result = await super().run(state)
        # Flatten database_package out of the wrapper
        if isinstance(result.get("database_package"), dict):
            inner = result["database_package"].get("database_package")
            if inner:
                result["database_package"] = inner
        # Carry forward all sub-specs
        result["database_package"]["schema_spec"]    = state.get("db_schema_spec")
        result["database_package"]["migration_spec"]  = state.get("db_migration_spec")
        result["database_package"]["index_spec"]      = state.get("db_index_spec")
        result["database_package"]["stored_proc_spec"] = state.get("db_stored_proc_spec")
        result["database_package"]["seed_data_spec"]  = state.get("db_seed_data_spec")
        return result
