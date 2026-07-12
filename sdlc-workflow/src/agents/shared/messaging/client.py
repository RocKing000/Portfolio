from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Callable, Awaitable

import aio_pika
from aio_pika import Message, DeliveryMode
from aio_pika.abc import AbstractChannel, AbstractConnection

from .models import AgentMessage, ComponentHandoff


class MessagingClient:
    """
    Async RabbitMQ client for all agent-to-agent and component-to-component messaging.
    Uses aio-pika for non-blocking operations within LangGraph agent graphs.
    """

    EXCHANGE_COMPONENTS = "sdlc.components"
    EXCHANGE_EVENTS     = "sdlc.events"
    EXCHANGE_REVIEW     = "sdlc.review"

    def __init__(self, url: str | None = None):
        self._url = url or os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/sdlc")
        self._connection: AbstractConnection | None = None
        self._channel: AbstractChannel | None = None

    async def connect(self) -> None:
        self._connection = await aio_pika.connect_robust(self._url)
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=1)

    async def disconnect(self) -> None:
        if self._connection and not self._connection.is_closed:
            await self._connection.close()

    async def publish_agent_message(self, message: AgentMessage) -> None:
        exchange = await self._channel.get_exchange(self.EXCHANGE_COMPONENTS)
        body = json.dumps(message.__dict__).encode()
        await exchange.publish(
            Message(
                body=body,
                delivery_mode=DeliveryMode.PERSISTENT,
                content_type="application/json",
                priority=message.priority,
                message_id=message.message_id,
                correlation_id=message.correlation_id or message.message_id,
            ),
            routing_key=message.routing_key,
        )

    async def publish_handoff(self, handoff: ComponentHandoff) -> None:
        routing_key = f"component.{handoff.to_component}.handoff"
        exchange = await self._channel.get_exchange(self.EXCHANGE_COMPONENTS)
        body = json.dumps(handoff.__dict__).encode()
        await exchange.publish(
            Message(
                body=body,
                delivery_mode=DeliveryMode.PERSISTENT,
                content_type="application/json",
                message_id=handoff.handoff_id,
            ),
            routing_key=routing_key,
        )

    async def publish_event(self, routing_key: str, payload: dict[str, Any]) -> None:
        exchange = await self._channel.get_exchange(self.EXCHANGE_EVENTS)
        body = json.dumps(payload).encode()
        await exchange.publish(
            Message(body=body, delivery_mode=DeliveryMode.PERSISTENT,
                    content_type="application/json"),
            routing_key=routing_key,
        )

    async def publish_review_item(self, payload: dict[str, Any]) -> None:
        exchange = await self._channel.get_exchange(self.EXCHANGE_REVIEW)
        body = json.dumps(payload).encode()
        await exchange.publish(
            Message(body=body, delivery_mode=DeliveryMode.PERSISTENT,
                    content_type="application/json"),
            routing_key="",
        )

    async def consume(
        self,
        queue_name: str,
        handler: Callable[[dict[str, Any]], Awaitable[None]],
    ) -> None:
        queue = await self._channel.get_queue(queue_name)

        async def _on_message(message: aio_pika.IncomingMessage) -> None:
            async with message.process(requeue=True):
                payload = json.loads(message.body.decode())
                await handler(payload)

        await queue.consume(_on_message)
