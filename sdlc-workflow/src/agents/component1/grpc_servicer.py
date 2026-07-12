"""
Component 1 gRPC servicer — handles sync calls from the .NET SessionService.
Async agent work is dispatched via RabbitMQ; this servicer only deals with
session management and gate decisions.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from shared.grpc_server.base_servicer import BaseComponentServicer

logger = logging.getLogger(__name__)


class Component1Servicer(BaseComponentServicer):
    def __init__(
        self,
        session_registry: dict[str, dict[str, Any]],
        messaging_client: Any,
    ):
        super().__init__(session_registry)
        self._messaging = messaging_client

    # ------------------------------------------------------------------
    async def StartSession(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        session_id  = request.session_id
        project_id  = request.project_id

        if session_id in self._sessions:
            return pb2.StartSessionResponse(
                accepted=False,
                message=f"Session {session_id} already active",
                queue_name="",
            )

        # Initialise state slot — graph populates this as it runs
        self._sessions[session_id] = {
            "session_id":       session_id,
            "project_id":       project_id,
            "operating_mode":   request.operating_mode,
            "llm_provider":     request.llm_provider,
            "model_tier":       request.model_tier,
            "status":           "Active",
            "current_agent":    "research",
            "pending_gate":     "",
            "iteration":        0,
            # None = not yet decided; gate_check nodes poll for non-None values.
            "gate1_approved":   None,
            "gate2_approved":   None,
            "gate3_approved":   None,
            "gate4_approved":   None,
            "errors":           [],
        }

        # Publish to RabbitMQ so the graph runner picks it up
        payload = {
            "session_id":     session_id,
            "project_id":     project_id,
            "operating_mode": request.operating_mode,
            "llm_provider":   request.llm_provider,
            "model_tier":     request.model_tier,
            **(json.loads(request.payload_json) if request.payload_json else {}),
        }
        await self._messaging.publish(
            exchange="sdlc.components",
            routing_key="component1.input",
            message=payload,
        )

        logger.info("Session %s started for Component 1", session_id)
        return pb2.StartSessionResponse(
            accepted=True,
            message="Session started",
            queue_name="component1.output",
        )

    async def GetPlanDocument(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        state = self._sessions.get(request.session_id)
        if state is None:
            return pb2.PlanDocumentResponse()

        minio_key = state.get("plan_document_key", "")
        return pb2.PlanDocumentResponse(
            minio_key=minio_key,
            download_url=f"/api/documents/download/{minio_key}",
            version=state.get("plan_version", 0),
        )

    async def UploadPlanDocument(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        state = self._sessions.get(request.session_id)
        if state is None:
            return pb2.UploadPlanResponse(accepted=False, diff_summary="Session not found")

        # Store uploaded key; diff is computed by DocumentService
        state["uploaded_plan_key"] = request.minio_key
        state["original_plan_key"] = request.original_key

        return pb2.UploadPlanResponse(
            accepted=True,
            diff_summary="Upload accepted; diff will be computed by DocumentService",
            diff_minio_key="",
            changes_count=0,
        )
