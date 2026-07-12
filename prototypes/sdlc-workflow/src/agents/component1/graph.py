from __future__ import annotations

from typing import Any, Literal

from langgraph.graph import StateGraph, END

from .state import Component1State
from .research.data_discovery import DataDiscoveryAgent
from .research.semantic_analysis import SemanticAnalysisAgent
from .research.outcome_analysis import OutcomeAnalysisAgent
from .research.gap_analysis import GapAnalysisAgent
from .implementation.requirements_extraction import RequirementsExtractionAgent
from .implementation.requirements_structuring import RequirementsStructuringAgent
from .implementation.conflict_resolution import ConflictResolutionAgent
from .implementation.translation import TranslationAgent
from .implementation.approval import ApprovalAgent
from .implementation.document_ingestion import DocumentIngestionAgent
from ..shared.base_agent import AgentContext
from ..shared.gate_utils import make_gate_check


def build_component1_graph(ctx: AgentContext) -> StateGraph:
    """
    Constructs the full Component 1 LangGraph graph.

    Flow:
      data_discovery → semantic_analysis ─┐
      outcome_analysis ────────────────────┼→ gap_analysis → [GATE 1] → extraction → ...
    """

    # Instantiate all agents with shared context
    data_discovery   = DataDiscoveryAgent(ctx)
    semantic         = SemanticAnalysisAgent(ctx)
    outcome          = OutcomeAnalysisAgent(ctx)
    gap              = GapAnalysisAgent(ctx)

    graph = StateGraph(Component1State)

    # --- Research Layer Nodes ---
    graph.add_node("data_discovery",  data_discovery.run)
    graph.add_node("semantic_analysis", semantic.run)
    graph.add_node("outcome_analysis",  outcome.run)
    graph.add_node("gap_analysis",      gap.run)

    # Gate 1 — waits for client to approve the research summary
    graph.add_node("gate1_check", make_gate_check(ctx.session_registry, "gate1_approved"))

    # --- Implementation Layer Nodes (fully implemented) ---
    extraction   = RequirementsExtractionAgent(ctx)
    structuring  = RequirementsStructuringAgent(ctx)
    conflict_res = ConflictResolutionAgent(ctx)
    translation  = TranslationAgent(ctx)
    approval     = ApprovalAgent(ctx)
    doc_ingest   = DocumentIngestionAgent(ctx)

    graph.add_node("requirements_extraction",  extraction.run)
    graph.add_node("requirements_structuring", structuring.run)
    graph.add_node("conflict_resolution",      conflict_res.run)
    graph.add_node("document_ingestion",       doc_ingest.run)
    graph.add_node("translation",              translation.run)
    graph.add_node("approval",                 approval.run)
    # Gates 2/3/4 share one check node — it determines the current gate dynamically.
    graph.add_node("impl_gate_check",          _make_impl_gate_check(ctx.session_registry))
    graph.add_node("safe_mode",                _safe_mode_node)
    graph.add_node("package_output",           _package_output)

    # --- Edges: Research Layer ---
    # data_discovery and outcome_analysis can run in parallel (no dependency)
    # but LangGraph requires a single entry point — we sequence for simplicity
    # and rely on async within each agent for internal concurrency
    graph.set_entry_point("data_discovery")
    graph.add_edge("data_discovery",   "semantic_analysis")
    graph.add_edge("semantic_analysis", "outcome_analysis")
    graph.add_edge("outcome_analysis",  "gap_analysis")
    graph.add_edge("gap_analysis",      "gate1_check")

    # --- Gate 1 conditional ---
    graph.add_conditional_edges(
        "gate1_check",
        _route_gate1,
        {
            "approved":   "requirements_extraction",
            "rejected":   "data_discovery",       # re-run research with corrections
            "safe_mode":  "safe_mode",
        },
    )

    # --- Implementation Layer Edges ---
    graph.add_edge("requirements_extraction",  "requirements_structuring")
    graph.add_edge("requirements_structuring", "conflict_resolution")
    graph.add_edge("conflict_resolution",      "document_ingestion")   # process any uploaded plan
    graph.add_edge("document_ingestion",       "translation")
    graph.add_edge("translation",              "impl_gate_check")
    graph.add_edge("impl_gate_check",          "approval")

    graph.add_conditional_edges(
        "approval",
        _route_approval,
        {
            "gate2_pending":  "translation",           # re-present for gate 2
            "gate3_pending":  "translation",           # conflict escalation round
            "gate4_approved": "package_output",        # final sign-off — done
            "rejected":       "requirements_extraction", # surgical re-run
            "safe_mode":      "safe_mode",
        },
    )

    graph.add_edge("package_output", END)
    graph.add_edge("safe_mode",      END)

    return graph


# ---------------------------------------------------------------------------
# Gate / routing helpers
# ---------------------------------------------------------------------------

def _make_impl_gate_check(session_registry: dict):
    """
    Gate check for C1 implementation gates (2/3/4).
    Determines the current gate dynamically from state, then waits for a decision.
    Writes client_feedback from gate_corrections so ApprovalAgent can process it.
    """
    import asyncio

    async def _impl_gate_check(state: Component1State) -> dict:
        session_id = state.get("session_id", "")
        operating_mode = state.get("operating_mode", "HITL")

        # Determine which gate we're at using the same logic as ApprovalAgent._current_gate
        if not state.get("gate2_approved"):
            gate_key, gate_label = "gate2_approved", "gate2"
        elif state.get("unresolved_conflicts") and not state.get("gate3_approved"):
            gate_key, gate_label = "gate3_approved", "gate3"
        else:
            gate_key, gate_label = "gate4_approved", "gate4"

        if operating_mode == "FullAutomation":
            return {gate_key: True, "current_agent": f"{gate_label}_auto_approved"}

        entry = session_registry.get(session_id)
        if entry is not None:
            entry.update({
                "current_agent": f"awaiting_{gate_label}",
                "status": "Paused",
                "pending_gate": gate_label,
            })

        while True:
            entry = session_registry.get(session_id)
            if entry is not None:
                decision = entry.get(gate_key)
                if decision is not None:
                    corrections = entry.pop("gate_corrections", {})
                    entry[gate_key] = None  # consume
                    entry.update({"status": "Active", "pending_gate": ""})
                    feedback = corrections.get("feedback", "") if isinstance(corrections, dict) else ""
                    label = "approved" if decision else "rejected"
                    return {
                        gate_key: decision,
                        "gate_corrections": corrections,
                        "client_feedback": feedback,
                        "current_agent": f"{gate_label}_{label}",
                    }
            await asyncio.sleep(1.0)

    return _impl_gate_check


def _route_gate1(state: Component1State) -> Literal["approved", "rejected", "safe_mode"]:
    if state.get("safe_mode"):
        return "safe_mode"
    if state.get("gate1_approved"):
        return "approved"
    return "rejected"


def _route_approval(state: Component1State) -> str:
    if state.get("safe_mode"):
        return "safe_mode"
    decision = state.get("approval_decision", {}).get("gate_decision", "pending")
    if state.get("gate4_approved"):
        return "gate4_approved"
    if decision == "rejected":
        return "rejected"
    if state.get("unresolved_conflicts") and not state.get("gate3_approved"):
        return "gate3_pending"
    if not state.get("gate2_approved"):
        return "gate2_pending"
    return "gate4_approved"


async def _safe_mode_node(state: Component1State) -> Component1State:
    return {**state, "safe_mode": True, "current_agent": "SafeMode"}


async def _package_output(state: Component1State) -> Component1State:
    package = {
        "structured_requirements": state.get("structured_requirements", []),
        "priority_ranking":        state.get("priority_ranking", []),
        "traceability_matrix":     state.get("traceability_matrix", []),
        "assumption_log":          state.get("assumption_log", []),
        "conflict_report":         state.get("conflict_report", []),
    }
    return {**state, "requirements_package": package, "current_agent": "PackageOutput"}


def _stub(agent_name: str):
    """Placeholder node for agents not yet implemented."""
    async def _node(state: Component1State) -> Component1State:
        return {**state, "current_agent": agent_name}
    _node.__name__ = agent_name
    return _node
