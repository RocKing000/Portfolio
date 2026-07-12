"""
Component 2 Agent Service — Design Automation entrypoint.

- Listens on RabbitMQ `component2.input`
- Runs the Component 2 LangGraph (20 agents: Research → Technical Design → UI/UX)
- Exposes HTTP health/metrics on :8000
- Exposes gRPC on :50052
"""
from __future__ import annotations

import asyncio
import logging
import os
import signal
from typing import Any

import structlog
from aiohttp import web
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from .grpc_servicer import Component2Servicer
from .runner import run_component2
from ..shared.messaging import MessagingClient
from ..shared.grpc_server import start_grpc_server

logger = structlog.get_logger("component2.main")

SESSION_COUNTER  = Counter("c2_sessions_total",          "Total Component 2 sessions processed")
SESSION_ERRORS   = Counter("c2_session_errors_total",    "Component 2 session errors")
SESSION_DURATION = Histogram("c2_session_duration_seconds", "Component 2 session duration")


def _make_message_handler(session_registry: dict[str, Any], messaging: "MessagingClient"):
    async def handle_session_message(payload: dict[str, Any]) -> None:
        session_id = payload.get("session_id", "unknown")
        log = logger.bind(session_id=session_id)
        SESSION_COUNTER.inc()
        log.info("session_received")

        with SESSION_DURATION.time():
            try:
                result = await run_component2(payload, session_registry, messaging)
                if session_id in session_registry:
                    session_registry[session_id].update({
                        "status": "SafeMode" if result.get("safe_mode") else "Completed",
                    })
                log.info("session_complete", gate3=result.get("gate3_approved"))
            except Exception as e:
                SESSION_ERRORS.inc()
                log.error("session_failed", error=str(e))
                if session_id in session_registry:
                    session_registry[session_id]["status"] = "SafeMode"
    return handle_session_message


async def health_handler(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok", "component": 2})


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
    logger.info("component2_agent_starting",
                rabbitmq_url=os.getenv("RABBITMQ_URL", "")[:30] + "...")

    session_registry: dict[str, Any] = {}
    handle_session_message = _make_message_handler(session_registry, messaging)
    await messaging.consume("component2.input", handle_session_message)

    web_app = web.Application()
    web_app.router.add_get("/health",  health_handler)
    web_app.router.add_get("/metrics", metrics_handler)
    runner = web.AppRunner(web_app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8000)
    await site.start()

    from generated import sdlc_agents_pb2_grpc as pb2_grpc  # noqa: PLC0415
    servicer   = Component2Servicer(session_registry, messaging)
    stop_event = asyncio.Event()

    grpc_task = asyncio.create_task(
        start_grpc_server(servicer, pb2_grpc.add_Component2ServiceServicer_to_server,
                          port=50051, stop_event=stop_event))

    logger.info("component2_agent_ready", http_port=8000, grpc_port=50051)

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    await stop_event.wait()
    logger.info("component2_agent_stopping")
    await grpc_task
    await messaging.disconnect()
    await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
