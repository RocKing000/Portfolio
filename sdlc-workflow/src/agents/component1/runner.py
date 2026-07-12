from __future__ import annotations

import asyncio
import os
from typing import Any

import redis.asyncio as aioredis

from ..shared.base_agent import AgentContext
from ..shared.llm_gateway import LLMGateway, ModelTier
from ..shared.anonymization import AnonymizationService, MappingRegistry
from ..shared.messaging import MessagingClient
from .graph import build_component1_graph
from .state import Component1State


async def run_component1(
    session_id: str,
    project_id: str,
    raw_data_source: dict[str, Any],
    expected_outcome: str,
    operating_mode: str = "HITL",
    llm_provider: str | None = None,
    model_tier: str = "Standard",
    sensitive_terms: list[str] | None = None,
    session_registry: dict[str, Any] | None = None,
    messaging: MessagingClient | None = None,
) -> dict[str, Any]:
    """
    Entry point for Component 1 execution.
    session_registry: shared dict owned by main(); gate nodes poll it for HITL decisions.
    messaging: existing MessagingClient from main() — reused so we don't create a second connection.
    """
    if session_registry is None:
        session_registry = {}

    # --- Infrastructure clients ---
    redis_client = aioredis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379"),
        decode_responses=False,
    )
    own_messaging = messaging is None
    if own_messaging:
        messaging = MessagingClient()
        await messaging.connect()

    llm = LLMGateway(provider=llm_provider)
    anon_registry = MappingRegistry(redis_client, session_id)
    anon = AnonymizationService(anon_registry, sensitive_terms=sensitive_terms)

    ctx = AgentContext(
        session_id=session_id,
        project_id=project_id,
        component=1,
        agent_name="Component1Runner",
        operating_mode=operating_mode,
        llm_gateway=llm,
        anonymization=anon,
        messaging=messaging,
        redis=redis_client,
        model_tier=ModelTier(model_tier),
        session_registry=session_registry,
    )

    # --- Build and compile graph ---
    graph = build_component1_graph(ctx)
    compiled = graph.compile()

    initial_state: Component1State = {
        "session_id": session_id,
        "project_id": project_id,
        "operating_mode": operating_mode,
        "iteration": 1,
        "raw_data_source": raw_data_source,
        "expected_outcome": expected_outcome,
        "errors": [],
        "safe_mode": False,
        "current_agent": "Initializing",
    }

    # Stream events so session_registry reflects real-time agent progress.
    final_state: dict[str, Any] = {}
    async for event in compiled.astream(initial_state):
        for _, state_update in event.items():
            if session_id in session_registry:
                reg = session_registry[session_id]
                if "current_agent" in state_update:
                    reg["current_agent"] = state_update["current_agent"]
                if state_update.get("safe_mode"):
                    reg["status"] = "SafeMode"
            final_state.update(state_update)

    if own_messaging:
        await messaging.disconnect()
    await redis_client.aclose()

    return final_state
