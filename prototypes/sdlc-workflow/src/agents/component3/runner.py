"""Component 3 execution runner — builds AgentContext and drives the LangGraph."""
from __future__ import annotations

import os
from typing import Any

import redis.asyncio as aioredis

from ..shared.base_agent import AgentContext
from ..shared.llm_gateway import LLMGateway, ModelTier
from ..shared.anonymization import AnonymizationService, MappingRegistry
from ..shared.messaging import MessagingClient
from .graph import build_component3_graph


async def run_component3(
    payload: dict[str, Any],
    session_registry: dict[str, Any],
    messaging: MessagingClient,
) -> dict[str, Any]:
    session_id = payload.get("session_id", "")

    redis_client = aioredis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379"),
        decode_responses=False,
    )
    llm = LLMGateway(provider=payload.get("llm_provider"))
    anon_registry = MappingRegistry(redis_client, session_id)
    anon = AnonymizationService(anon_registry)

    ctx = AgentContext(
        session_id=session_id,
        project_id=payload.get("project_id", ""),
        component=3,
        agent_name="Component3Runner",
        operating_mode=payload.get("operating_mode", "HITL"),
        llm_gateway=llm,
        anonymization=anon,
        messaging=messaging,
        redis=redis_client,
        model_tier=ModelTier(payload.get("model_tier", "Standard")),
        session_registry=session_registry,
    )

    graph = build_component3_graph(ctx)
    compiled = graph.compile()

    initial_state = {
        "session_id":    session_id,
        "project_id":    payload.get("project_id", ""),
        "operating_mode": payload.get("operating_mode", "HITL"),
        "errors":        [],
        "safe_mode":     False,
        "current_agent": "Initializing",
        **{k: v for k, v in payload.items()
           if k not in ("session_id", "project_id", "operating_mode", "llm_provider", "model_tier")},
    }

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

    await redis_client.aclose()
    return final_state
