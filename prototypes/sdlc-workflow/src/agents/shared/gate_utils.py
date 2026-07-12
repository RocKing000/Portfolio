"""
Gate check utilities for HITL (Human-in-the-Loop) gates in LangGraph graphs.

Protocol:
  - session_registry[session_id][gate_key] starts as None (undecided).
  - gRPC SubmitGateDecision writes True (approved) or False (rejected).
  - The gate_check node polls, consumes the value (resets to None), and returns it
    into graph state so the conditional router can route correctly.
  - session_registry[session_id]["pending_gate"] is set while waiting and cleared
    when the decision is consumed — used by GetSessionStatus to report the pending gate.
"""
from __future__ import annotations

import asyncio
from typing import Any


def make_gate_check(
    session_registry: dict[str, dict[str, Any]],
    gate_key: str,
    poll_interval: float = 1.0,
):
    """
    Returns an async LangGraph node that pauses execution until a human decision
    arrives for the named gate.

    gate_key: e.g. "gate1_approved"

    In FullAutomation mode the node auto-approves immediately.
    In HITL mode it polls session_registry for a non-None value, then consumes it.
    """
    gate_label = gate_key.replace("_approved", "")

    async def _gate_check(state: dict) -> dict:
        session_id = state.get("session_id", "")
        operating_mode = state.get("operating_mode", "HITL")

        if operating_mode == "FullAutomation":
            return {
                gate_key: True,
                "current_agent": f"{gate_label}_auto_approved",
            }

        # Mark session as paused and waiting for this gate.
        entry = session_registry.get(session_id)
        if entry is not None:
            entry.update({
                "current_agent": f"awaiting_{gate_label}",
                "status": "Paused",
                "pending_gate": gate_label,
            })

        # Poll until a decision (True or False) is written by SubmitGateDecision.
        while True:
            entry = session_registry.get(session_id)
            if entry is not None:
                decision = entry.get(gate_key)  # None = not yet decided
                if decision is not None:
                    # Consume the value so the next gate check starts clean.
                    corrections = entry.pop("gate_corrections", {})
                    entry[gate_key] = None
                    entry.update({
                        "status": "Active",
                        "pending_gate": "",
                    })
                    label = "approved" if decision else "rejected"
                    client_feedback = (
                        corrections.get("feedback", "")
                        if isinstance(corrections, dict) else str(corrections)
                    )
                    return {
                        gate_key: decision,
                        "gate_corrections": corrections,
                        "client_feedback": client_feedback,
                        "current_agent": f"{gate_label}_{label}",
                    }
            await asyncio.sleep(poll_interval)

    _gate_check.__name__ = f"gate_check_{gate_label}"
    return _gate_check
