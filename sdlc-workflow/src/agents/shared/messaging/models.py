from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class AgentMessage:
    """Standard message envelope for all inter-agent communication."""
    message_id: str
    session_id: str
    project_id: str
    component: int
    source_agent: str
    target_agent: str | None
    payload: dict[str, Any]
    routing_key: str
    priority: int = 5
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    correlation_id: str | None = None
    reply_to: str | None = None


@dataclass
class ComponentHandoff:
    """Package dispatched via RabbitMQ from one component to the next."""
    handoff_id: str
    from_component: int
    to_component: int
    session_id: str
    project_id: str
    package_minio_key: str
    schema_version: str = "1.0"
    acknowledged: bool = False
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
