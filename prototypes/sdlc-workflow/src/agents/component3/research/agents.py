"""Component 3 research layer — 4 agents."""
from __future__ import annotations

from typing import Any
from shared.llm_gateway.base import ModelTier
from ..base_spec_agent import LayerSpecAgent


class DesignInterpretationAgent(LayerSpecAgent):
    """Translates the C2 design package into implementation-ready specs."""
    AGENT_NAME = "design_interpretation"
    OUTPUT_KEY = "implementation_context"
    MODEL_TIER = ModelTier.PREMIUM
    INPUT_KEYS = ["design_package", "requirements_package"]
    SYSTEM_PROMPT = """
You are a senior engineer parsing a design package into implementation specifications.

Return JSON:
{
  "tech_stack_confirmed": {"frontend": "", "backend": "", "database": "", "cache": "", "messaging": ""},
  "layer_boundaries": {
    "database": "<what belongs to the DB layer>",
    "backend":  "<what belongs to the backend>",
    "frontend": "<what belongs to the frontend>",
    "ai_ml":    "<AI/ML scope or 'not required'>",
    "integration": "<integration scope>"
  },
  "ai_ml_required": false,
  "module_list": [
    {"id": "MOD-001", "name": "", "layer": "backend|frontend|database|integration|ai_ml", "priority": "must|should|could"}
  ],
  "cross_cutting_concerns": {
    "auth_enforcement": "<where auth is checked>",
    "logging":          "<logging strategy per layer>",
    "error_propagation":"<how errors surface across layers>",
    "validation":       "<where validation runs: client|server|both>"
  },
  "open_design_questions": ["<ambiguity needing resolution>"]
}
"""


class DependencyMappingAgent(LayerSpecAgent):
    """Maps all package/library dependencies needed per layer."""
    AGENT_NAME = "dependency_mapping"
    OUTPUT_KEY = "dependency_map"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["implementation_context", "design_package"]
    SYSTEM_PROMPT = """
You are a build engineer mapping all code dependencies for each layer.

Return JSON:
{
  "database": {
    "migration_tool": "<Flyway|Liquibase|Alembic>",
    "orm_or_query": "<Dapper|SQLAlchemy|Prisma|none>"
  },
  "backend": {
    "language": "",
    "framework": "",
    "dependencies": [{"name": "", "version": "", "purpose": ""}]
  },
  "frontend": {
    "language": "",
    "framework": "",
    "dependencies": [{"name": "", "version": "", "purpose": ""}]
  },
  "ai_ml": {
    "required": false,
    "framework": "",
    "dependencies": []
  },
  "shared": [{"name": "", "version": "", "purpose": "", "layers": []}],
  "security_review_needed": ["<dependency with licence/security concern>"]
}
"""


class SpecificationPlanningAgent(LayerSpecAgent):
    """Produces the implementation sequencing and spec template index."""
    AGENT_NAME = "specification_planning"
    OUTPUT_KEY = "specification_plan"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["implementation_context", "dependency_map"]
    SYSTEM_PROMPT = """
You are a technical project manager sequencing the implementation specification work.

Return JSON:
{
  "implementation_sequence": [
    {"order": 1, "layer": "database", "rationale": "<why first>"}
  ],
  "spec_templates": {
    "database": "<which template pattern: schema-first|model-first>",
    "backend":  "<which pattern: hexagonal|layered|clean>",
    "frontend": "<which pattern: feature-module|atomic|page-per-route>"
  },
  "review_config": {
    "database":    {"review_required": true, "reviewer_role": "SeniorDeveloper"},
    "backend":     {"review_required": true, "reviewer_role": "SeniorDeveloper"},
    "frontend":    {"review_required": true, "reviewer_role": "UIUXLead"},
    "ai_ml":       {"review_required": true, "reviewer_role": "MLEngineer"},
    "integration": {"review_required": true, "reviewer_role": "IntegrationSpecialist"}
  },
  "parallel_opportunities": ["<what can be built in parallel>"],
  "critical_path": ["<ordered critical path items>"]
}
"""


class RiskGapAnalysisAgent(LayerSpecAgent):
    """Identifies implementation risks and design gaps before Gate 1."""
    AGENT_NAME = "risk_gap_analysis"
    OUTPUT_KEY = "implementation_risk_report"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["implementation_context", "dependency_map", "specification_plan"]
    SYSTEM_PROMPT = """
You are a risk analyst identifying implementation risks and design gaps.

Return JSON:
{
  "risks": [
    {"id": "RISK-001", "layer": "backend|frontend|database|ai_ml|integration",
     "description": "", "probability": "low|medium|high", "impact": "low|medium|high",
     "mitigation": "", "severity": "critical|major|minor"}
  ],
  "design_gaps": [
    {"id": "GAP-001", "description": "<what's missing from the design>",
     "layer": "", "resolution": "<assumption made to proceed>"}
  ],
  "go_no_go": "go|conditional_go",
  "gate1_summary": "<2-3 sentence summary for Gate 1 review>"
}
"""
