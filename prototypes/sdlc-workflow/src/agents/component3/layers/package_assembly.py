"""Component 3 — Package Assembly agent: assembles all layers into the development package."""
from __future__ import annotations

import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)


class PackageAssemblyAgent(BaseAgent):
    def __init__(self, context: AgentContext):
        super().__init__(context)

    def build_graph(self):
        raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        session_id = state.get("session_id", "")

        development_package = {
            "session_id":        session_id,
            "project_id":        state.get("project_id"),
            "database_layer":    state.get("database_package", {}),
            "backend_layer":     state.get("backend_package", {}),
            "frontend_layer":    state.get("frontend_package", {}),
            "ai_ml_layer":       state.get("aiml_package"),
            "integration_layer": state.get("integration_package", {}),
            "module_list":       state.get("implementation_context", {}).get("module_list", []),
            "tech_stack":        state.get("implementation_context", {}).get("tech_stack_confirmed", {}),
            "dependency_map":    state.get("dependency_map", {}),
            "implementation_risks": state.get("implementation_risk_report", {}).get("risks", []),
        }

        # Compute summary stats
        db  = state.get("database_package", {})
        be  = state.get("backend_package", {})
        fe  = state.get("frontend_package", {})
        ml  = state.get("aiml_package")
        int_ = state.get("integration_package", {})

        development_package["summary"] = {
            "tables_specified":           len(state.get("db_schema_analysis", {}).get("tables", [])),
            "backend_services":           len(state.get("be_analysis", {}).get("services", [])),
            "api_endpoints":              be.get("controller_spec", {}) and "defined" or "see backend_layer",
            "frontend_modules":           len(state.get("fe_analysis", {}).get("feature_modules", [])),
            "integration_adapters":       int_.get("external_adapters", 0),
            "ml_models":                  len(state.get("ml_model_spec", {}).get("models", [])) if ml else 0,
            "ai_ml_included":             ml is not None,
        }

        logger.info("PackageAssembly complete: all layers assembled for session %s", session_id)

        # Publish for internal review before Gate 3
        await self.publish_plan_for_review(
            plan_minio_key=f"sessions/{session_id}/development_package.json",
            context_summary=f"C3 development package: {development_package['summary']}",
            priority="high",
            review_type="implementation",
        )

        return {
            **state,
            "development_package": development_package,
            "current_agent":       "package_assembly",
        }
