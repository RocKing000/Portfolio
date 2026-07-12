"""Component 3 — Integration layer agents (7 agents)."""
from __future__ import annotations

from shared.llm_gateway.base import ModelTier
from ..base_spec_agent import LayerSpecAgent

_INT_CONTEXT = ["design_package", "backend_package", "implementation_context", "dependency_map"]


class INTIntegrationAnalysisAgent(LayerSpecAgent):
    AGENT_NAME = "int_integration_analysis"
    OUTPUT_KEY = "int_analysis"
    MODEL_TIER = ModelTier.PREMIUM
    INPUT_KEYS = _INT_CONTEXT
    SYSTEM_PROMPT = """
Analyse all integration points and define the integration architecture.

Return JSON:
{
  "external_systems": [
    {"id": "EXT-001", "name": "", "type": "rest_api|graphql|grpc|webhook|database|sdk",
     "direction": "inbound|outbound|bidirectional",
     "criticality": "critical|important|nice_to_have",
     "sla": {"availability": "99.9%", "latency_p99_ms": 500}}
  ],
  "message_queue_required": true,
  "event_driven_patterns": ["<pattern>"],
  "integration_layer_placement": "<shared lib|dedicated service|per-service adapters>"
}
"""


class INTExternalServiceSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "int_external_service_specification"
    OUTPUT_KEY = "int_external_service_spec"
    MODEL_TIER = ModelTier.PREMIUM
    INPUT_KEYS = ["int_analysis", "design_package"]
    MAX_TOKENS = 8000
    SYSTEM_PROMPT = """
Specify each external service adapter implementation.

Return JSON:
{
  "adapters": [
    {"id": "EXT-001", "class_name": "<ExternalServiceAdapter>",
     "pattern": "facade|anti_corruption|gateway",
     "client_config": {"base_url": "", "timeout_ms": 5000, "auth_type": "api_key|oauth2|jwt"},
     "methods": [
       {"name": "", "maps_to_endpoint": "", "request_mapping": "<how domain maps to external>",
        "response_mapping": "<how external maps to domain>", "retry_policy": {"attempts": 3, "backoff": "exponential"}}
     ],
     "circuit_breaker": {"enabled": true, "failure_threshold": 5, "recovery_timeout_s": 30},
     "health_check": {"endpoint": "", "interval_s": 30}
    }
  ]
}
"""


class INTMessageQueueSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "int_message_queue_specification"
    OUTPUT_KEY = "int_mq_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["int_analysis", "design_package"]
    SYSTEM_PROMPT = """
Specify all message queue exchanges, queues, and consumer configurations.

Return JSON:
{
  "broker": "RabbitMQ|Kafka|SQS|Azure Service Bus",
  "exchanges": [
    {"name": "", "type": "topic|direct|fanout|headers", "durable": true}
  ],
  "queues": [
    {"name": "", "exchange": "", "routing_key": "", "durable": true,
     "dlq": "<dead letter queue name>", "message_ttl_ms": null,
     "consumer": {"service": "", "prefetch": 10, "ack_mode": "manual|auto"}}
  ],
  "message_schemas": [
    {"queue": "", "schema": {"type": "object", "properties": {}}, "version": "1.0"}
  ],
  "poison_message_handling": "<retry + DLQ strategy>"
}
"""


class INTEventSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "int_event_specification"
    OUTPUT_KEY = "int_event_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["int_analysis", "be_service_spec", "design_package"]
    SYSTEM_PROMPT = """
Specify all domain events and their publishing/consuming contracts.

Return JSON:
{
  "domain_events": [
    {"name": "<UserRegistered>", "producer_service": "", "version": "1.0",
     "payload": {"type": "object", "properties": {}},
     "consumers": [{"service": "", "handler": "", "is_async": true}],
     "ordering": "none|per_aggregate",
     "idempotency": "<how consumers handle duplicate events>"}
  ],
  "outbox_pattern": {"required": true, "implementation": "<Debezium|custom>"},
  "saga_patterns": [
    {"name": "", "steps": [], "compensation": []}
  ]
}
"""


class INTWebhookSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "int_webhook_specification"
    OUTPUT_KEY = "int_webhook_spec"
    MODEL_TIER = ModelTier.ECONOMY
    INPUT_KEYS = ["int_analysis", "be_controller_spec"]
    SYSTEM_PROMPT = """
Specify inbound and outbound webhook handling.

Return JSON:
{
  "inbound_webhooks": [
    {"path": "/webhooks/<provider>", "provider": "", "auth": "hmac|basic|none",
     "secret_env_var": "", "events_handled": [],
     "idempotency_key": "<header or field used>", "async_processing": true}
  ],
  "outbound_webhooks": [
    {"trigger_event": "", "target_url_configurable": true,
     "payload_schema": {}, "retry_policy": {"attempts": 3, "backoff": "exponential"},
     "signing_header": "X-Signature-256"}
  ]
}
"""


class INTIntegrationErrorHandlingAgent(LayerSpecAgent):
    AGENT_NAME = "int_integration_error_handling"
    OUTPUT_KEY = "int_error_handling_spec"
    MODEL_TIER = ModelTier.ECONOMY
    INPUT_KEYS = ["int_analysis", "int_external_service_spec", "int_mq_spec"]
    SYSTEM_PROMPT = """
Specify integration-layer error handling and observability.

Return JSON:
{
  "error_categories": [
    {"category": "transient|permanent|timeout|auth|rate_limit",
     "strategy": "retry|dead_letter|alert|ignore",
     "max_retries": 3, "alert_channel": ""}
  ],
  "dead_letter_processing": {"monitoring": "Kibana|Grafana", "retry_from_dlq": "manual|scheduled"},
  "integration_observability": {
    "metrics": ["adapter_latency_ms", "adapter_error_rate", "queue_depth"],
    "tracing": "<propagate correlation ID across all calls>",
    "dashboards": ["Integration Health", "Queue Depths"]
  }
}
"""


class INTCodeGenerationAgent(LayerSpecAgent):
    """Assembles the integration layer package."""
    AGENT_NAME = "int_integration_code_generation"
    OUTPUT_KEY = "integration_package"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["int_analysis", "int_external_service_spec", "int_mq_spec",
                  "int_event_spec", "int_webhook_spec", "int_error_handling_spec"]
    SYSTEM_PROMPT = """
Assemble the integration layer handoff package. Return JSON:
{
  "integration_package": {
    "external_adapters": 0,
    "queues_defined": 0,
    "events_defined": 0,
    "webhooks_defined": 0,
    "ready_for_package_assembly": true,
    "summary": ""
  }
}
"""

    async def run(self, state):
        result = await super().run(state)
        pkg = result.get("integration_package", {})
        if isinstance(pkg, dict) and "integration_package" in pkg:
            pkg = pkg["integration_package"]
        pkg.update({
            "analysis":              state.get("int_analysis"),
            "external_service_spec": state.get("int_external_service_spec"),
            "mq_spec":               state.get("int_mq_spec"),
            "event_spec":            state.get("int_event_spec"),
            "webhook_spec":          state.get("int_webhook_spec"),
            "error_handling_spec":   state.get("int_error_handling_spec"),
        })
        result["integration_package"] = pkg
        return result
