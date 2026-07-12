from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict

from langgraph.graph import StateGraph, END

from ..shared.base_agent import AgentContext
from ..shared.gate_utils import make_gate_check
from .research import (
    RequirementsInterpretationAgent,
    AssetDiscoveryAgent,
    TechnicalFeasibilityAgent,
    ArchitectureOptionsAgent,
    UIUXStrategyAgent,
    DependencyIntegrationAgent,
    RiskAnalysisAgent,
)
from .technical_design import (
    SystemArchitectureAgent,
    ComponentDesignAgent,
    DataModelAgent,
    APIDesignAgent,
    IntegrationDesignAgent,
    TechnicalDocumentationAgent,
)
from .uiux_design import (
    FigmaWorkspaceAgent,
    DesignSystemSpecAgent,
    ScreenDesignAgent,
    InteractionFlowAgent,
    DesignReviewAgent,
    DesignPackageAssemblyAgent,
)


class C2State(TypedDict, total=False):
    # Session
    session_id:          str
    project_id:          str
    operating_mode:      str
    requirements_package: dict[str, Any]
    existing_codebase_info: str

    # Research outputs
    design_constraints:      list
    non_negotiables:         list
    design_principles:       list
    design_ambiguities:      list
    technology_hints:        dict
    quality_attributes:      dict
    existing_assets:         list
    design_system:           dict
    third_party_services:    list
    oss_dependencies:        list
    feasibility_assessment:  dict
    tech_stack:              dict
    feasibility_blockers:    list
    technical_risks:         list
    architecture_options:    list
    recommended_arch:        str
    arch_recommendation_rationale: str
    key_adrs:                list
    component_map:           dict
    user_personas:           list
    user_journeys:           list
    interaction_patterns:    list
    design_system_decision:  dict
    accessibility_reqs:      dict
    responsive_strategy:     str
    information_architecture: dict
    integrations:            list
    auth_architecture:       dict
    data_flows:              list
    integration_risks:       list
    risk_register:           list
    top_risks:               list
    risk_summary:            str
    go_no_go:                str
    go_conditions:           list

    # Gate 1
    gate1_approved:          bool
    gate1_corrections:       dict

    # Technical design outputs
    architecture_blueprint:  dict
    services:                list
    layers:                  list
    deployment_topology:     dict
    component_designs:       list
    data_model:              dict
    entities:                list
    relationships:           list
    database_strategy:       dict
    api_contract:            dict
    api_endpoints:           list
    api_style:               str
    integration_designs:     list
    event_contracts:         list
    design_document:         dict
    adrs:                    list
    module_spec_index:       list
    design_package:          dict

    # Gate 2
    gate2_approved:          bool
    gate2_corrections:       dict

    # UI/UX design (stubs — elaborated in future sprint)
    figma_workspace_url:     str
    design_system_spec:      dict
    screen_designs:          list
    gate3_approved:          bool

    # Meta
    current_agent:           str
    safe_mode:               bool
    errors: Annotated[list[str], operator.add]


def _stub(name: str):
    async def node(state: C2State) -> dict:
        return {"current_agent": name}
    node.__name__ = name
    return node


def _make_node(agent_cls, ctx: AgentContext):
    agent = agent_cls(ctx)
    async def node(state: C2State) -> dict:
        return await agent.run(state)
    node.__name__ = agent_cls.__name__
    return node


def _route_gate1(state: C2State) -> str:
    if state.get("safe_mode"):
        return "safe_mode"
    if state.get("gate1_approved"):
        return "system_architecture"
    return "requirements_interpretation"  # loop back for correction


def _route_gate2(state: C2State) -> str:
    if state.get("safe_mode"):
        return "safe_mode"
    if state.get("gate2_approved"):
        return "figma_workspace"
    return "system_architecture"  # loop back for correction


def _route_gate3(state: C2State) -> str:
    if state.get("safe_mode"):
        return "safe_mode"
    if state.get("gate3_approved"):
        return END
    return "figma_workspace"  # loop back


def _build_gate_checks(ctx: AgentContext):
    """Returns gate check nodes bound to this session's registry."""
    return {
        "gate1": make_gate_check(ctx.session_registry, "gate1_approved"),
        "gate2": make_gate_check(ctx.session_registry, "gate2_approved"),
        "gate3": make_gate_check(ctx.session_registry, "gate3_approved"),
    }


def build_component2_graph(ctx: AgentContext) -> StateGraph:
    graph = StateGraph(C2State)
    gates = _build_gate_checks(ctx)

    # ---- Research nodes ----
    graph.add_node("requirements_interpretation", _make_node(RequirementsInterpretationAgent, ctx))
    graph.add_node("asset_discovery",             _make_node(AssetDiscoveryAgent, ctx))
    graph.add_node("technical_feasibility",       _make_node(TechnicalFeasibilityAgent, ctx))
    graph.add_node("architecture_options",        _make_node(ArchitectureOptionsAgent, ctx))
    graph.add_node("uiux_strategy",               _make_node(UIUXStrategyAgent, ctx))
    graph.add_node("dependency_integration",      _make_node(DependencyIntegrationAgent, ctx))
    graph.add_node("risk_analysis",               _make_node(RiskAnalysisAgent, ctx))
    graph.add_node("gate1_check",                 gates["gate1"])

    # ---- Technical design nodes ----
    graph.add_node("system_architecture",    _make_node(SystemArchitectureAgent, ctx))
    graph.add_node("component_design",       _make_node(ComponentDesignAgent, ctx))
    graph.add_node("data_model",             _make_node(DataModelAgent, ctx))
    graph.add_node("api_design",             _make_node(APIDesignAgent, ctx))
    graph.add_node("integration_design",     _make_node(IntegrationDesignAgent, ctx))
    graph.add_node("technical_documentation",_make_node(TechnicalDocumentationAgent, ctx))
    graph.add_node("gate2_check",            gates["gate2"])

    # ---- UI/UX nodes ----
    graph.add_node("figma_workspace",         _make_node(FigmaWorkspaceAgent, ctx))
    graph.add_node("design_system_spec",      _make_node(DesignSystemSpecAgent, ctx))
    graph.add_node("screen_design",           _make_node(ScreenDesignAgent, ctx))
    graph.add_node("interaction_flow",        _make_node(InteractionFlowAgent, ctx))
    graph.add_node("design_review",           _make_node(DesignReviewAgent, ctx))
    graph.add_node("design_package_assembly", _make_node(DesignPackageAssemblyAgent, ctx))
    graph.add_node("gate3_check",             gates["gate3"])
    graph.add_node("safe_mode",               _stub("SafeMode"))

    # ---- Entry ----
    graph.set_entry_point("requirements_interpretation")

    # ---- Research chain ----
    research_chain = [
        "requirements_interpretation", "asset_discovery", "technical_feasibility",
        "architecture_options", "uiux_strategy", "dependency_integration",
        "risk_analysis", "gate1_check",
    ]
    for a, b in zip(research_chain, research_chain[1:]):
        graph.add_edge(a, b)

    # Gate 1 routing
    graph.add_conditional_edges("gate1_check", _route_gate1, {
        "system_architecture":       "system_architecture",
        "requirements_interpretation": "requirements_interpretation",
        "safe_mode":                 "safe_mode",
    })

    # ---- Technical design chain ----
    tech_chain = [
        "system_architecture", "component_design", "data_model",
        "api_design", "integration_design", "technical_documentation", "gate2_check",
    ]
    for a, b in zip(tech_chain, tech_chain[1:]):
        graph.add_edge(a, b)

    # Gate 2 routing
    graph.add_conditional_edges("gate2_check", _route_gate2, {
        "figma_workspace":    "figma_workspace",
        "system_architecture": "system_architecture",
        "safe_mode":          "safe_mode",
    })

    # ---- UI/UX chain ----
    uiux_chain = [
        "figma_workspace", "design_system_spec",
        "screen_design", "interaction_flow", "design_review",
        "design_package_assembly", "gate3_check",
    ]
    for a, b in zip(uiux_chain, uiux_chain[1:]):
        graph.add_edge(a, b)

    # Gate 3 routing
    graph.add_conditional_edges("gate3_check", _route_gate3, {
        END:               END,
        "figma_workspace": "figma_workspace",
        "safe_mode":       "safe_mode",
    })

    graph.add_edge("safe_mode", END)

    return graph
