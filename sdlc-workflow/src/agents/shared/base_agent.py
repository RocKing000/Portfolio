from __future__ import annotations

import asyncio
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, TypeVar

import redis.asyncio as aioredis
import structlog
from langgraph.graph import StateGraph

from .llm_gateway import LLMGateway, LLMRequest, LLMResponse, ModelTier
from .anonymization import AnonymizationService, MappingRegistry
from .messaging import MessagingClient


logger = structlog.get_logger(__name__)

StateT = TypeVar("StateT", bound=dict)


@dataclass
class AgentContext:
    """Runtime context injected into every agent instance."""
    session_id: str
    project_id: str
    component: int
    agent_name: str
    operating_mode: str           # HITL | FullAutomation
    llm_gateway: LLMGateway
    anonymization: AnonymizationService
    messaging: MessagingClient
    redis: aioredis.Redis
    model_tier: ModelTier = ModelTier.STANDARD
    iteration: int = 1
    # Shared in-memory dict owned by main(); gate check nodes poll this for decisions.
    session_registry: dict = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseAgent(ABC):
    """
    Base class for every agent in the SDLC suite.

    Enforces:
    - Anonymization before every LLM call (data never leaves raw)
    - Usage tracking after every LLM call
    - Audit event emission after every action
    - SafeMode entry on unrecoverable errors
    - Plan download/upload hooks
    """

    component: int = 0
    agent_name: str = "BaseAgent"

    def __init__(self, ctx: AgentContext):
        self.ctx = ctx
        self._log = structlog.get_logger(self.agent_name).bind(
            session_id=ctx.session_id,
            project_id=ctx.project_id,
            component=ctx.component,
        )

    # ------------------------------------------------------------------
    # LLM call — always anonymized
    # ------------------------------------------------------------------

    async def llm_call(
        self,
        messages: list[dict[str, str]],
        system: str | None = None,
        model_tier: ModelTier | None = None,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        """
        Execute an LLM call with mandatory anonymization.
        De-anonymizes the response before returning.
        """
        # Anonymize all message content before sending
        anon_messages = []
        for msg in messages:
            anon_content, _ = await self.ctx.anonymization.anonymize(msg["content"])
            anon_messages.append({**msg, "content": anon_content})

        anon_system = None
        if system:
            anon_system, _ = await self.ctx.anonymization.anonymize(system)

        request = LLMRequest(
            messages=anon_messages,
            system=anon_system,
            model_tier=model_tier or self.ctx.model_tier,
            max_tokens=max_tokens,
            session_id=self.ctx.session_id,
            agent_name=self.agent_name,
        )

        response = await self.ctx.llm_gateway.complete(request)

        # De-anonymize the response
        response.content = await self.ctx.anonymization.deanonymize(response.content)

        await self._emit_audit("LLMCall", {
            "provider": response.provider,
            "model": response.model,
            "prompt_tokens": response.prompt_tokens,
            "completion_tokens": response.completion_tokens,
            "cost_usd": response.estimated_cost_usd,
            "latency_ms": response.latency_ms,
        })

        return response

    # ------------------------------------------------------------------
    # Audit
    # ------------------------------------------------------------------

    async def _emit_audit(self, event_type: str, details: dict[str, Any]) -> None:
        try:
            await self.ctx.messaging.publish_event(
                routing_key=f"audit.{event_type.lower()}",
                payload={
                    "event_type": event_type,
                    "session_id": self.ctx.session_id,
                    "project_id": self.ctx.project_id,
                    "component": self.ctx.component,
                    "agent_name": self.agent_name,
                    "actor_type": "Agent",
                    "details": details,
                },
            )
        except Exception as e:
            self._log.warning("audit_emit_failed", error=str(e))

    # ------------------------------------------------------------------
    # Plan download/upload support
    # ------------------------------------------------------------------

    async def publish_plan_for_review(
        self,
        plan_minio_key: str,
        context_summary: str,
        priority: str = "Normal",
        review_type: str = "AgentOutput",
    ) -> None:
        """Post this agent's output to the internal review queue."""
        await self.ctx.messaging.publish_review_item({
            "session_id": self.ctx.session_id,
            "component": self.ctx.component,
            "review_type": review_type,
            "agent_name": self.agent_name,
            "priority": priority,
            "context_summary": context_summary,
            "output_minio_key": plan_minio_key,
        })
        self._log.info("plan_posted_to_review_queue", minio_key=plan_minio_key)

    # ------------------------------------------------------------------
    # SafeMode
    # ------------------------------------------------------------------

    async def enter_safe_mode(self, reason: str) -> None:
        self._log.error("entering_safemode", reason=reason)
        await self.ctx.messaging.publish_event(
            routing_key="notify.safemode",
            payload={
                "session_id": self.ctx.session_id,
                "component": self.ctx.component,
                "agent_name": self.agent_name,
                "reason": reason,
            },
        )
        await self._emit_audit("SystemEvent", {"action": "SafeModeEntered", "reason": reason})

    # ------------------------------------------------------------------
    # Abstract interface
    # ------------------------------------------------------------------

    @abstractmethod
    def build_graph(self) -> StateGraph:
        """Return the LangGraph StateGraph that defines this agent's logic."""

    @abstractmethod
    async def run(self, input_state: dict[str, Any]) -> dict[str, Any]:
        """Execute the agent and return its output state."""
