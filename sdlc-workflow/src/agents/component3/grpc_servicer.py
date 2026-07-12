"""Component 3 gRPC servicer — Development Automation."""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.grpc_server.base_servicer import BaseComponentServicer

logger = logging.getLogger(__name__)


class Component3Servicer(BaseComponentServicer):
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
            "current_agent":  "design_interpretation",
            "pending_gate":   "",
            "iteration":      0,
            "gate1_approved": None,
            "gate2_approved": None,
            "errors":         [],
            "module_statuses": {},
        }

        payload = {
            "session_id":     session_id,
            "project_id":     request.project_id,
            "operating_mode": request.operating_mode,
            **(json.loads(request.payload_json) if request.payload_json else {}),
        }
        await self._messaging.publish(
            exchange="sdlc.components",
            routing_key="component3.input",
            message=payload,
        )

        logger.info("Session %s started for Component 3", session_id)
        return pb2.StartSessionResponse(
            accepted=True,
            message="Session started",
            queue_name="component3.output",
        )

    async def GetPlanDocument(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        state = self._sessions.get(request.session_id)
        if state is None:
            return pb2.PlanDocumentResponse()

        minio_key = state.get("package_minio_key", "")
        return pb2.PlanDocumentResponse(
            minio_key=minio_key,
            download_url=f"/api/documents/download/{minio_key}",
            version=state.get("package_version", 0),
        )

    async def GetModuleSpec(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        state = self._sessions.get(request.session_id)
        if state is None:
            return pb2.ModuleSpecResponse()

        module_id = request.module_id
        specs = state.get("module_specs", {})
        spec  = specs.get(module_id, {})

        return pb2.ModuleSpecResponse(
            module_id=module_id,
            layer=spec.get("layer", ""),
            status=spec.get("status", "pending"),
            minio_key=spec.get("minio_key", ""),
            download_url=f"/api/documents/download/{spec.get('minio_key', '')}",
        )

    async def ApproveCodeGeneration(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        state = self._sessions.get(request.session_id)
        if state is None:
            return pb2.CodeGenApprovalResponse(accepted=False, message="Session not found")

        module_statuses = state.setdefault("module_statuses", {})
        module_statuses[request.module_id] = "approved" if request.approved else "rejected"

        return pb2.CodeGenApprovalResponse(
            accepted=True,
            message=f"Module {request.module_id} {'approved' if request.approved else 'rejected'}",
        )

    async def AssignModule(self, request, context):
        from generated import sdlc_agents_pb2 as pb2  # noqa: PLC0415

        state = self._sessions.get(request.session_id)
        if state is None:
            return pb2.ModuleAssignmentResponse(accepted=False, message="Session not found")

        assignments = state.setdefault("module_assignments", {})
        assignments[request.module_id] = {
            "type":    request.assignment_type,
            "assignee": request.assignee_id,
        }

        return pb2.ModuleAssignmentResponse(
            accepted=True,
            message=f"Module {request.module_id} assigned to {request.assignee_id}",
        )
