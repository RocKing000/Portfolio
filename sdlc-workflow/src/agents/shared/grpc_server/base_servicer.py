"""
Base gRPC servicer with shared session state lookup.
Each component servicer inherits this and implements component-specific RPCs.
"""
from __future__ import annotations

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Any

import grpc

logger = logging.getLogger(__name__)


class BaseComponentServicer(ABC):
    """Common helpers available to all component servicers."""

    def __init__(self, session_registry: dict[str, dict[str, Any]]):
        # session_id -> state dict maintained by the agent graph
        self._sessions = session_registry

    # ------------------------------------------------------------------
    # Shared RPC implementations
    # ------------------------------------------------------------------

    async def GetSessionStatus(self, request, context):
        """Returns current graph execution status for a session."""
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        session_id = request.session_id
        state = self._sessions.get(session_id)

        if state is None:
            return pb2.SessionStatusResponse(
                session_id=session_id,
                status="NotFound",
                error_message="Session not found",
            )

        # pending_gate is explicitly set/cleared by gate_check nodes (see gate_utils.py).
        pending_gate = state.get("pending_gate", "")

        return pb2.SessionStatusResponse(
            session_id=session_id,
            status=state.get("status", "Active"),
            current_agent=state.get("current_agent", ""),
            iteration=state.get("iteration", 0),
            pending_gate=pending_gate,
            error_message=state.get("errors", [""])[-1] if state.get("errors") else "",
        )

    async def SubmitGateDecision(self, request, context):
        """Writes gate decision into shared session state so the graph can proceed."""
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        session_id = request.session_id
        state = self._sessions.get(session_id)

        if state is None:
            return pb2.GateDecisionResponse(
                accepted=False,
                message="Session not found",
            )

        gate_key = f"{request.gate_id}_approved"   # e.g. "gate1_approved"
        approved = request.decision.lower() == "approved"
        state[gate_key] = approved

        if not approved and request.feedback_json:
            try:
                state["gate_corrections"] = json.loads(request.feedback_json)
            except json.JSONDecodeError:
                state["gate_corrections"] = {"raw_feedback": request.feedback_json}

        state["approved_by"] = request.approved_by_user_id
        next_action = "Resuming graph" if approved else "Routing to correction loop"

        logger.info("Gate decision received: session=%s gate=%s approved=%s",
                    session_id, request.gate_id, approved)

        return pb2.GateDecisionResponse(
            accepted=True,
            next_action=next_action,
            message=f"{request.gate_id} {'approved' if approved else 'rejected'}",
        )

    @abstractmethod
    async def StartSession(self, request, context):
        """Component-specific: validate input, enqueue work, return queue name."""

    @abstractmethod
    async def GetPlanDocument(self, request, context):
        """Component-specific: return MinIO key for the current plan document."""
