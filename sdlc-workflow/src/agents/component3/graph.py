from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict

from langgraph.graph import StateGraph, END

from ..shared.base_agent import AgentContext
from ..shared.gate_utils import make_gate_check
from .research import (
    DesignInterpretationAgent, DependencyMappingAgent,
    SpecificationPlanningAgent, RiskGapAnalysisAgent,
)
from .layers import (
    # DB
    DBSchemaAnalysisAgent, DBSchemaSpecificationAgent, DBMigrationSpecificationAgent,
    DBIndexSpecificationAgent, DBStoredProcSpecificationAgent, DBSeedDataSpecificationAgent,
    DBCodeGenerationAgent,
    # Backend
    BEBackendAnalysisAgent, BERepositorySpecificationAgent, BEServiceSpecificationAgent,
    BEControllerSpecificationAgent, BEAuthSpecificationAgent, BEMiddlewareSpecificationAgent,
    BEErrorHandlingSpecificationAgent, BECodeGenerationAgent,
    # Frontend
    FEFrontendAnalysisAgent, FERoutingSpecificationAgent, FEStateManagementSpecificationAgent,
    FEAPIIntegrationSpecificationAgent, FESharedComponentSpecificationAgent,
    FEFormValidationSpecificationAgent, FEFeatureModuleSpecificationAgent, FECodeGenerationAgent,
    # AI/ML
    MLAIMLAnalysisAgent, MLDataPipelineSpecificationAgent, MLModelSpecificationAgent,
    MLTrainingPipelineSpecificationAgent, MLInferenceServiceSpecificationAgent,
    MLModelMonitoringSpecificationAgent, MLCodeGenerationAgent,
    # Integration
    INTIntegrationAnalysisAgent, INTExternalServiceSpecificationAgent,
    INTMessageQueueSpecificationAgent, INTEventSpecificationAgent, INTWebhookSpecificationAgent,
    INTIntegrationErrorHandlingAgent, INTCodeGenerationAgent,
    # Assembly
    PackageAssemblyAgent,
)


class C3State(TypedDict, total=False):
    session_id: str
    project_id: str
    design_package: dict[str, Any]
    requirements_package: dict[str, Any]

    # Research
    implementation_context: dict
    dependency_map: dict
    specification_plan: dict
    implementation_risk_report: dict

    # Gate 1
    gate1_approved: bool
    gate1_corrections: dict

    # DB layer
    db_schema_analysis: dict
    db_schema_spec: dict
    db_migration_spec: dict
    db_index_spec: dict
    db_stored_proc_spec: dict
    db_seed_data_spec: dict
    database_package: dict

    # Backend layer
    be_analysis: dict
    be_repository_spec: dict
    be_service_spec: dict
    be_controller_spec: dict
    be_auth_spec: dict
    be_middleware_spec: dict
    be_error_handling_spec: dict
    backend_package: dict

    # Frontend layer
    fe_analysis: dict
    fe_routing_spec: dict
    fe_state_spec: dict
    fe_api_spec: dict
    fe_shared_component_spec: dict
    fe_form_validation_spec: dict
    fe_feature_module_spec: dict
    frontend_package: dict

    # AI/ML layer (conditional)
    aiml_required: bool
    ml_analysis: dict
    ml_data_pipeline_spec: dict
    ml_model_spec: dict
    ml_training_spec: dict
    ml_inference_spec: dict
    ml_monitoring_spec: dict
    aiml_package: dict

    # Integration layer
    int_analysis: dict
    int_external_service_spec: dict
    int_mq_spec: dict
    int_event_spec: dict
    int_webhook_spec: dict
    int_error_handling_spec: dict
    integration_package: dict

    # Final
    development_package: dict

    # Gate 2
    gate2_approved: bool
    gate2_corrections: dict

    # Meta
    current_agent: str
    safe_mode: bool
    errors: Annotated[list[str], operator.add]


def _make_node(agent_cls, ctx: AgentContext):
    agent = agent_cls(ctx)
    async def node(state: C3State) -> dict:
        return await agent.run(state)
    node.__name__ = agent_cls.__name__
    return node


def _build_gate_checks(ctx: AgentContext):
    return {
        "gate1": make_gate_check(ctx.session_registry, "gate1_approved"),
        "gate2": make_gate_check(ctx.session_registry, "gate2_approved"),
    }


def _route_gate1(state: C3State) -> str:
    if state.get("safe_mode"):        return "safe_mode"
    if state.get("gate1_approved"):   return "db_schema_analysis"
    return "design_interpretation"


def _route_after_frontend(state: C3State) -> str:
    if state.get("aiml_required", False):
        return "ml_aiml_analysis"
    return "int_integration_analysis"


def _route_gate2(state: C3State) -> str:
    if state.get("safe_mode"):        return "safe_mode"
    if state.get("gate2_approved"):   return END
    return "db_schema_analysis"


def build_component3_graph(ctx: AgentContext) -> StateGraph:
    graph = StateGraph(C3State)
    gates = _build_gate_checks(ctx)

    def node(cls): return _make_node(cls, ctx)

    # Research
    graph.add_node("design_interpretation",  node(DesignInterpretationAgent))
    graph.add_node("dependency_mapping",     node(DependencyMappingAgent))
    graph.add_node("specification_planning", node(SpecificationPlanningAgent))
    graph.add_node("risk_gap_analysis",      node(RiskGapAnalysisAgent))
    graph.add_node("gate1_check",            gates["gate1"])

    # DB layer
    graph.add_node("db_schema_analysis",        node(DBSchemaAnalysisAgent))
    graph.add_node("db_schema_specification",   node(DBSchemaSpecificationAgent))
    graph.add_node("db_migration_specification",node(DBMigrationSpecificationAgent))
    graph.add_node("db_index_specification",    node(DBIndexSpecificationAgent))
    graph.add_node("db_stored_proc_specification", node(DBStoredProcSpecificationAgent))
    graph.add_node("db_seed_data_specification",node(DBSeedDataSpecificationAgent))
    graph.add_node("db_code_generation",        node(DBCodeGenerationAgent))

    # Backend layer
    graph.add_node("be_backend_analysis",           node(BEBackendAnalysisAgent))
    graph.add_node("be_repository_specification",   node(BERepositorySpecificationAgent))
    graph.add_node("be_service_specification",      node(BEServiceSpecificationAgent))
    graph.add_node("be_controller_specification",   node(BEControllerSpecificationAgent))
    graph.add_node("be_auth_specification",         node(BEAuthSpecificationAgent))
    graph.add_node("be_middleware_specification",   node(BEMiddlewareSpecificationAgent))
    graph.add_node("be_error_handling_specification", node(BEErrorHandlingSpecificationAgent))
    graph.add_node("be_backend_code_generation",    node(BECodeGenerationAgent))

    # Frontend layer
    graph.add_node("fe_frontend_analysis",              node(FEFrontendAnalysisAgent))
    graph.add_node("fe_routing_specification",          node(FERoutingSpecificationAgent))
    graph.add_node("fe_state_management_specification", node(FEStateManagementSpecificationAgent))
    graph.add_node("fe_api_integration_specification",  node(FEAPIIntegrationSpecificationAgent))
    graph.add_node("fe_shared_component_specification", node(FESharedComponentSpecificationAgent))
    graph.add_node("fe_form_validation_specification",  node(FEFormValidationSpecificationAgent))
    graph.add_node("fe_feature_module_specification",   node(FEFeatureModuleSpecificationAgent))
    graph.add_node("fe_frontend_code_generation",       node(FECodeGenerationAgent))

    # AI/ML layer
    graph.add_node("ml_aiml_analysis",                  node(MLAIMLAnalysisAgent))
    graph.add_node("ml_data_pipeline_specification",    node(MLDataPipelineSpecificationAgent))
    graph.add_node("ml_model_specification",            node(MLModelSpecificationAgent))
    graph.add_node("ml_training_pipeline_specification",node(MLTrainingPipelineSpecificationAgent))
    graph.add_node("ml_inference_service_specification",node(MLInferenceServiceSpecificationAgent))
    graph.add_node("ml_model_monitoring_specification", node(MLModelMonitoringSpecificationAgent))
    graph.add_node("ml_aiml_code_generation",           node(MLCodeGenerationAgent))

    # Integration layer
    graph.add_node("int_integration_analysis",          node(INTIntegrationAnalysisAgent))
    graph.add_node("int_external_service_specification",node(INTExternalServiceSpecificationAgent))
    graph.add_node("int_message_queue_specification",   node(INTMessageQueueSpecificationAgent))
    graph.add_node("int_event_specification",           node(INTEventSpecificationAgent))
    graph.add_node("int_webhook_specification",         node(INTWebhookSpecificationAgent))
    graph.add_node("int_integration_error_handling",    node(INTIntegrationErrorHandlingAgent))
    graph.add_node("int_integration_code_generation",   node(INTCodeGenerationAgent))

    graph.add_node("package_assembly", node(PackageAssemblyAgent))
    graph.add_node("gate2_check",      gates["gate2"])
    graph.add_node("safe_mode",        lambda s: {"current_agent": "safe_mode"})

    # ---- Edges ----
    graph.set_entry_point("design_interpretation")

    for a, b in zip(
        ["design_interpretation", "dependency_mapping", "specification_planning", "risk_gap_analysis"],
        ["dependency_mapping", "specification_planning", "risk_gap_analysis", "gate1_check"]
    ):
        graph.add_edge(a, b)

    graph.add_conditional_edges("gate1_check", _route_gate1, {
        "db_schema_analysis":   "db_schema_analysis",
        "design_interpretation": "design_interpretation",
        "safe_mode":            "safe_mode",
    })

    db_chain = ["db_schema_analysis", "db_schema_specification", "db_migration_specification",
                "db_index_specification", "db_stored_proc_specification",
                "db_seed_data_specification", "db_code_generation"]
    for a, b in zip(db_chain, db_chain[1:]):
        graph.add_edge(a, b)

    be_chain = ["be_backend_analysis", "be_repository_specification", "be_service_specification",
                "be_controller_specification", "be_auth_specification",
                "be_middleware_specification", "be_error_handling_specification",
                "be_backend_code_generation"]
    graph.add_edge(db_chain[-1], be_chain[0])
    for a, b in zip(be_chain, be_chain[1:]):
        graph.add_edge(a, b)

    fe_chain = ["fe_frontend_analysis", "fe_routing_specification",
                "fe_state_management_specification", "fe_api_integration_specification",
                "fe_shared_component_specification", "fe_form_validation_specification",
                "fe_feature_module_specification", "fe_frontend_code_generation"]
    graph.add_edge(be_chain[-1], fe_chain[0])
    for a, b in zip(fe_chain, fe_chain[1:]):
        graph.add_edge(a, b)

    # Conditional: AI/ML or skip to integration
    graph.add_conditional_edges(fe_chain[-1], _route_after_frontend, {
        "ml_aiml_analysis":       "ml_aiml_analysis",
        "int_integration_analysis": "int_integration_analysis",
    })

    ml_chain = ["ml_aiml_analysis", "ml_data_pipeline_specification", "ml_model_specification",
                "ml_training_pipeline_specification", "ml_inference_service_specification",
                "ml_model_monitoring_specification", "ml_aiml_code_generation"]
    for a, b in zip(ml_chain, ml_chain[1:]):
        graph.add_edge(a, b)
    graph.add_edge(ml_chain[-1], "int_integration_analysis")

    int_chain = ["int_integration_analysis", "int_external_service_specification",
                 "int_message_queue_specification", "int_event_specification",
                 "int_webhook_specification", "int_integration_error_handling",
                 "int_integration_code_generation"]
    for a, b in zip(int_chain, int_chain[1:]):
        graph.add_edge(a, b)

    graph.add_edge(int_chain[-1], "package_assembly")
    graph.add_edge("package_assembly",  "gate2_check")
    graph.add_conditional_edges("gate2_check", _route_gate2, {
        END:                  END,
        "db_schema_analysis": "db_schema_analysis",
        "safe_mode":          "safe_mode",
    })
    graph.add_edge("safe_mode", END)

    return graph
