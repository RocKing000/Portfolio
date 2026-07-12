"""
Starts the gRPC server alongside the aiohttp health server.
Import and call start_grpc_server() from each component's main.py.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import grpc
from grpc import aio

logger = logging.getLogger(__name__)

_DEFAULT_PORT = 50051
_MAX_WORKERS  = 10


async def start_grpc_server(
    servicer: Any,
    add_servicer_fn: Any,
    port: int = _DEFAULT_PORT,
    stop_event: asyncio.Event | None = None,
) -> None:
    """
    Starts an async gRPC server with the given servicer.

    Parameters
    ----------
    servicer        : Instance of a proto-generated *Servicer class
    add_servicer_fn : The generated add_*Servicer_to_server function
    port            : TCP port to listen on (default 50051)
    stop_event      : If provided, server shuts down when this event is set
    """
    server = aio.server()
    add_servicer_fn(servicer, server)
    listen_addr = f"[::]:{port}"
    server.add_insecure_port(listen_addr)
    await server.start()
    logger.info("gRPC server listening on %s", listen_addr)

    if stop_event is not None:
        await stop_event.wait()
    else:
        await server.wait_for_termination()

    await server.stop(grace=5)
    logger.info("gRPC server stopped")
