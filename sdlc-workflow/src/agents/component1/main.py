"""
Component 1 Agent Service — entrypoint.

Responsibilities:
- Listen on RabbitMQ queue `component1.input` for incoming session requests
- Process each request by running the Component 1 LangGraph
- Publish output to `component1.output` / `sdlc.components` exchange
- Expose Prometheus metrics on :8000/metrics
- Expose health endpoint on :8000/health
- Serve gRPC on :50051 for synchronous .NET calls
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
from typing import Any

import structlog
from aiohttp import web
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from .runner import run_component1
from .grpc_servicer import Component1Servicer
from ..shared.messaging import MessagingClient
from ..shared.grpc_server import start_grpc_server

logger = structlog.get_logger("component1.main")

# --- Metrics ---
SESSION_COUNTER = Counter("c1_sessions_total", "Total Component 1 sessions processed")
SESSION_ERRORS  = Counter("c1_session_errors_total", "Component 1 session errors")
SESSION_DURATION = Histogram("c1_session_duration_seconds", "Component 1 session duration")


def _make_message_handler(
    session_registry: dict[str, Any],
    messaging: "MessagingClient",
):
    """Returns a handle_session_message closure that captures shared state."""
    async def handle_session_message(payload: dict[str, Any]) -> None:
        session_id  = payload.get("session_id", "unknown")
        project_id  = payload.get("project_id", "unknown")
        log = logger.bind(session_id=session_id)

        SESSION_COUNTER.inc()
        log.info("session_received")

        with SESSION_DURATION.time():
            try:
                result = await run_component1(
                    session_id       = session_id,
                    project_id       = project_id,
                    raw_data_source  = payload.get("raw_data_source", {}),
                    expected_outcome = payload.get("expected_outcome", ""),
                    operating_mode   = payload.get("operating_mode", "HITL"),
                    llm_provider     = payload.get("llm_provider"),
                    model_tier       = payload.get("model_tier", "Standard"),
                    sensitive_terms  = payload.get("sensitive_terms", []),
                    session_registry = session_registry,
                    messaging        = messaging,
                )
                # Sync final state back so gRPC can see completed status.
                if session_id in session_registry:
                    session_registry[session_id].update({
                        "status": "SafeMode" if result.get("safe_mode") else "Completed",
                        "current_agent": result.get("current_agent", ""),
                    })
                log.info("session_complete",
                         gate4=result.get("gate4_approved"),
                         safe_mode=result.get("safe_mode"))
            except Exception as e:
                SESSION_ERRORS.inc()
                log.error("session_failed", error=str(e))
                if session_id in session_registry:
                    session_registry[session_id]["status"] = "SafeMode"
    return handle_session_message


async def health_handler(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok", "component": 1})


async def metrics_handler(request: web.Request) -> web.Response:
    return web.Response(body=generate_latest(), content_type=CONTENT_TYPE_LATEST)


async def main() -> None:
    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
    )

    messaging = MessagingClient()
    await messaging.connect()

    logger.info("component1_agent_starting",
                rabbitmq_url=os.getenv("RABBITMQ_URL", "")[:30] + "...")

    # Shared in-memory session registry (session_id → state dict)
    session_registry: dict[str, Any] = {}

    # Start consuming from RabbitMQ
    handle_session_message = _make_message_handler(session_registry, messaging)
    await messaging.consume("component1.input", handle_session_message)

    # HTTP server for health + metrics
    web_app = web.Application()
    web_app.router.add_get("/health",  health_handler)
    web_app.router.add_get("/metrics", metrics_handler)
    runner = web.AppRunner(web_app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8000)
    await site.start()

    # gRPC server on :50051
    from generated import sdlc_agents_pb2_grpc as pb2_grpc  # noqa: PLC0415
    servicer   = Component1Servicer(session_registry, messaging)
    stop_event = asyncio.Event()

    grpc_task = asyncio.create_task(
        start_grpc_server(servicer, pb2_grpc.add_Component1ServiceServicer_to_server,
                          port=50051, stop_event=stop_event))

    logger.info("component1_agent_ready", http_port=8000, grpc_port=50051)

    # Graceful shutdown
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    await stop_event.wait()
    logger.info("component1_agent_stopping")
    await grpc_task
    await messaging.disconnect()
    await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
