from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict

from langgraph.graph import StateGraph, END

from ..shared.base_agent import AgentContext
from ..shared.gate_utils import make_gate_check
from .research import (
    CodebaseAnalysisAgent, TestabilityAnalysisAgent,
    BaselineMetricsAgent, TestStrategyAgent,
)
from .core_loop import (
    RandomScenarioGeneratorAgent, TestExecutionAgent,
    FailureAnalysisAgent, FixGenerationAgent,
    PerformanceImpactAgent, RegressionCheckAgent,
    IterationReportAgent,
)
from .final_report import FinalReportAgent

TRACKS = ("unit", "integration", "system", "performance", "security")


class C4State(TypedDict, total=False):
    session_id: str
    project_id: str
    codebase_path: str
    development_package: dict[str, Any]

    # Research outputs
    codebase_map: dict
    testability_map: dict
    mock_registry: list
    test_data_strategy: dict
    baseline_metrics: dict
    performance_thresholds: dict
    estimated_scenarios: dict
    test_strategy: dict

    # Gate 1
    gate1_approved: bool
    gate1_corrections: dict

    # Active iteration state
    active_track: str
    iteration_number: int
    track_reports: dict         # {track: [report, ...]}
    scenario_batch: list
    execution_results: list
    execution_summary: dict
    failure_analyses: list
    fixes_applied: list
    fixes_rejected: list
    performance_impact_report: dict
    regressions_found: list
    iteration_report: dict
    unfixed_issues: list

    # Track completion flags
    unit_complete: bool
    integration_complete: bool
    system_complete: bool
    performance_complete: bool
    security_complete: bool

    # Iteration decision (from client via gRPC)
    continue_iteration: bool | None
    iteration_decision: dict

    # Final
    final_report: dict
    final_report_key: str

    # Gate 2
    gate2_approved: bool

    # Meta
    current_agent: str
    safe_mode: bool
    errors: Annotated[list[str], operator.add]


def _make(cls, ctx: AgentContext):
    agent = cls(ctx)
    async def node(state: C4State) -> dict:
        return await agent.run(state)
    node.__name__ = cls.__name__
    return node


def _build_gate_checks(ctx: AgentContext):
    return {
        "gate1": make_gate_check(ctx.session_registry, "gate1_approved"),
        "gate2": make_gate_check(ctx.session_registry, "gate2_approved"),
    }


def _route_gate1(state: C4State) -> str:
    if state.get("safe_mode"):      return "safe_mode"
    if state.get("gate1_approved"): return "track_router"
    return "research_codebase_analysis"


def _route_track_router(state: C4State) -> str:
    """Select the next track to run, or go to final_report if all done."""
    if state.get("safe_mode"):
        return "safe_mode"

    if all(state.get(f"{t}_complete", False) for t in TRACKS):
        return "final_report"

    for track in TRACKS:
        if not state.get(f"{track}_complete", False):
            return "loop"
    return "final_report"


def _route_iteration_decision(state: C4State) -> str:
    """After client iteration decision: continue same track or advance."""
    decision = state.get("iteration_decision", {})
    if decision.get("continue_", False):
        return "continue"
    return "next"


def _route_gate2(state: C4State) -> str:
    if state.get("safe_mode"):       return "safe_mode"
    if state.get("gate2_approved"):  return END
    return "final_report"


async def _track_router(state: C4State) -> dict:
    """Sets active_track to the next incomplete track."""
    for track in TRACKS:
        if not state.get(f"{track}_complete", False):
            return {"active_track": track, "iteration_number": 1,
                    "scenario_batch": [], "execution_results": [],
                    "failure_analyses": [], "fixes_applied": [], "fixes_rejected": [],
                    "regressions_found": [], "current_agent": "track_router"}
    return {"current_agent": "track_router"}


async def _iteration_decision(state: C4State) -> dict:
    """
    Pause point: waits for client iteration decision via gRPC SubmitIterationDecision.
    The gRPC servicer writes iteration_decision into session_registry state.
    """
    decision   = state.get("iteration_decision", {})
    track      = state.get("active_track", "unit")
    continue_  = decision.get("continue_", False)

    if not continue_:
        # Mark track complete and bump to next
        new_state = {f"{track}_complete": True, "continue_iteration": False,
                     "current_agent": "iteration_decision"}
    else:
        new_state = {"continue_iteration": True,
                     "iteration_number": state.get("iteration_number", 1) + 1,
                     "current_agent": "iteration_decision"}
    return new_state


def build_component4_graph(ctx: AgentContext) -> StateGraph:
    graph = StateGraph(C4State)
    gates = _build_gate_checks(ctx)

    def node(cls): return _make(cls, ctx)

    # Research
    graph.add_node("research_codebase_analysis",  node(CodebaseAnalysisAgent))
    graph.add_node("research_testability_analysis", node(TestabilityAnalysisAgent))
    graph.add_node("research_baseline_metrics",   node(BaselineMetricsAgent))
    graph.add_node("research_test_strategy",      node(TestStrategyAgent))
    graph.add_node("gate1_check",                 gates["gate1"])

    # Track routing
    graph.add_node("track_router",       _track_router)
    graph.add_node("iteration_decision", _iteration_decision)

    # Core loop (7 agents)
    graph.add_node("loop_random_scenario_generator", node(RandomScenarioGeneratorAgent))
    graph.add_node("loop_test_execution",            node(TestExecutionAgent))
    graph.add_node("loop_failure_analysis",          node(FailureAnalysisAgent))
    graph.add_node("loop_fix_generation",            node(FixGenerationAgent))
    graph.add_node("loop_performance_impact",        node(PerformanceImpactAgent))
    graph.add_node("loop_regression_check",          node(RegressionCheckAgent))
    graph.add_node("loop_iteration_report",          node(IterationReportAgent))

    # Final
    graph.add_node("final_report", node(FinalReportAgent))
    graph.add_node("gate2_check",  gates["gate2"])
    graph.add_node("safe_mode",    lambda s: {"current_agent": "safe_mode"})

    # ---- Edges ----
    graph.set_entry_point("research_codebase_analysis")

    research_chain = [
        "research_codebase_analysis", "research_testability_analysis",
        "research_baseline_metrics", "research_test_strategy", "gate1_check",
    ]
    for a, b in zip(research_chain, research_chain[1:]):
        graph.add_edge(a, b)

    graph.add_conditional_edges("gate1_check", _route_gate1, {
        "track_router":              "track_router",
        "research_codebase_analysis": "research_codebase_analysis",
        "safe_mode":                 "safe_mode",
    })

    # track_router → loop or final
    graph.add_conditional_edges("track_router", _route_track_router, {
        "loop":         "loop_random_scenario_generator",
        "final_report": "final_report",
        "safe_mode":    "safe_mode",
    })

    # Core loop chain
    loop_chain = [
        "loop_random_scenario_generator", "loop_test_execution",
        "loop_failure_analysis", "loop_fix_generation",
        "loop_performance_impact", "loop_regression_check",
        "loop_iteration_report", "iteration_decision",
    ]
    for a, b in zip(loop_chain, loop_chain[1:]):
        graph.add_edge(a, b)

    # After iteration decision: continue same track or advance to next track
    graph.add_conditional_edges("iteration_decision", _route_iteration_decision, {
        "continue": "loop_random_scenario_generator",
        "next":     "track_router",
    })

    graph.add_edge("final_report", "gate2_check")
    graph.add_conditional_edges("gate2_check", _route_gate2, {
        END:           END,
        "final_report": "final_report",
        "safe_mode":   "safe_mode",
    })
    graph.add_edge("safe_mode", END)

    return graph
