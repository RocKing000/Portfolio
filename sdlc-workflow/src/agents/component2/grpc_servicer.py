"""Component 2 gRPC servicer — Design Automation."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from shared.grpc_server.base_servicer import BaseComponentServicer

logger = logging.getLogger(__name__)


class Component2Servicer(BaseComponentServicer):
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
            "current_agent":  "requirements_interpretation",
            "pending_gate":   "",
            "iteration":      0,
            "gate1_approved": None,
            "gate2_approved": None,
            "gate3_approved": None,
            "errors":         [],
        }

        payload = {
            "session_id":     session_id,
            "project_id":     request.project_id,
            "operating_mode": request.operating_mode,
            **(json.loads(request.payload_json) if request.payload_json else {}),
        }
        await self._messaging.publish(
            exchange="sdlc.components",
            routing_key="component2.input",
            message=payload,
        )

        logger.info("Session %s started for Component 2", session_id)
        return pb2.StartSessionResponse(
            accepted=True,
            message="Session started",
            queue_name="component2.output",
        )

    async def GetPlanDocument(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        state = self._sessions.get(request.session_id)
        if state is None:
            return pb2.PlanDocumentResponse()

        minio_key = state.get("design_document_key", "")
        return pb2.PlanDocumentResponse(
            minio_key=minio_key,
            download_url=f"/api/documents/download/{minio_key}",
            version=state.get("design_version", 0),
        )

    async def GetFigmaUrl(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        state = self._sessions.get(request.session_id)
        if state is None:
            return pb2.FigmaUrlResponse()

        return pb2.FigmaUrlResponse(
            figma_file_url=state.get("figma_file_url", ""),
            embed_url=state.get("figma_embed_url", ""),
            workspace_status=state.get("figma_workspace_status", "pending"),
        )
