"""Component 4 gRPC servicer — Testing Automation."""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.grpc_server.base_servicer import BaseComponentServicer

logger = logging.getLogger(__name__)

TRACKS = ("unit", "integration", "system", "performance", "security")


class Component4Servicer(BaseComponentServicer):
    def __init__(self, session_registry: dict[str, dict[str, Any]], messaging_client: Any):
        super().__init__(session_registry)
        self._messaging = messaging_client

    async def StartSession(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        session_id = request.session_id
        if session_id in self._sessions:
            return pb2.StartSessionResponse(accepted=False, message="Session already active", queue_name="")

        self._sessions[session_id] = {
            "session_id":     session_id,
            "project_id":     request.project_id,
            "operating_mode": request.operating_mode,
            "status":         "Active",
            "current_agent":  "research_codebase_analysis",
            "pending_gate":   "",
            "iteration":      0,
            "current_track":  "unit",
            "gate1_approved": None,
            "gate2_approved": None,
            "errors":         [],
            "track_reports":  {t: [] for t in TRACKS},
        }

        payload = {
            "session_id":     session_id,
            "project_id":     request.project_id,
            "operating_mode": request.operating_mode,
            **(json.loads(request.payload_json) if request.payload_json else {}),
        }
        await self._messaging.publish(
            exchange="sdlc.components",
            routing_key="component4.input",
            message=payload,
        )

        logger.info("Session %s started for Component 4", session_id)
        return pb2.StartSessionResponse(
            accepted=True,
            message="Session started",
            queue_name="component4.output",
        )

    async def GetPlanDocument(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        state = self._sessions.get(request.session_id)
        if state is None:
            return pb2.PlanDocumentResponse()

        minio_key = state.get("final_report_key", "")
        return pb2.PlanDocumentResponse(
            minio_key=minio_key,
            download_url=f"/api/documents/download/{minio_key}",
            version=1,
        )

    async def GetIterationReport(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        state = self._sessions.get(request.session_id)
        if state is None:
            return pb2.IterationReportResponse()

        track   = request.track
        reports = state.get("track_reports", {}).get(track, [])
        idx     = request.iteration_number - 1

        if not reports or idx >= len(reports):
            return pb2.IterationReportResponse(
                session_id=request.session_id,
                track=track,
                iteration_number=request.iteration_number,
            )

        rpt = reports[idx]
        return pb2.IterationReportResponse(
            session_id=request.session_id,
            track=track,
            iteration_number=rpt.get("iteration", request.iteration_number),
            scenarios_total=rpt.get("scenarios_total", 0),
            passed=rpt.get("passed", 0),
            failed=rpt.get("failed", 0),
            fixes_applied=rpt.get("fixes_applied", 0),
            unfixed_issues=rpt.get("unfixed_issues", 0),
            report_minio_key=rpt.get("report_minio_key", ""),
            recommendation=rpt.get("recommendation", "continue"),
        )

    async def SubmitIterationDecision(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        state = self._sessions.get(request.session_id)
        if state is None:
            return pb2.IterationDecisionResponse(accepted=False, next_action="Session not found")

        state["iteration_decision"] = {
            "track":      request.track,
            "continue_":  request.continue_,
            "decided_by": request.decided_by,
        }

        next_action = (
            f"Continuing iteration on track '{request.track}'"
            if request.continue_
            else f"Advancing to next track after '{request.track}'"
        )

        return pb2.IterationDecisionResponse(accepted=True, next_action=next_action)
