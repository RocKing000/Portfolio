# SDLC Workflow — Multi-Agent Automation Platform

A multi-agent platform that automates each phase of the software development lifecycle. Four agents handle requirements gathering, design, development, and testing — each operating independently over gRPC and coordinated through a C# .NET API gateway. Infrastructure is fully containerised.

---

## Agents

| Agent | Phase | Responsibility |
|---|---|---|
| Component 1 | Requirements | Ingestion, extraction, conflict resolution, translation, approval |
| Component 2 | Design | Technical design (API, data model, system architecture) + UI/UX design (Figma workspace, screen design, interaction flows) |
| Component 3 | Development | Code generation across backend, frontend, database, AI/ML, and integration layers |
| Component 4 | Testing | Test case generation, core test loop, final report assembly |

A shared LLM gateway underpins all agents with provider abstraction across Anthropic, OpenAI, Google, and Mistral.

---

## Stack

| Component | Technology |
|---|---|
| Agents | Python (LangGraph / gRPC) |
| API Gateway | C# .NET (Ocelot) |
| Frontend | Angular |
| Message Queue | RabbitMQ |
| Cache | Redis |
| Object Storage | MinIO |
| Auth | Keycloak |
| Database | SQL Server |
| Observability | ELK stack (Elasticsearch, Logstash, Kibana) |
| Metrics | Prometheus + Grafana |
| Containerisation | Docker Compose |

---

## Structure

```
src/agents/
    component1/         ← Requirements agent
        graph.py
        grpc_servicer.py
        implementation/     ← approval, conflict_resolution, document_ingestion, extraction
        research/           ← data_discovery, gap_analysis, outcome_analysis, semantic_analysis
    component2/         ← Design agent
        technical_design/   ← api_design, component_design, data_model, system_architecture
        uiux_design/        ← figma_workspace, screen_design, interaction_flow, design_review
    component3/         ← Development agent
        layers/             ← backend, frontend, database, aiml, integration, package_assembly
    component4/         ← Testing agent
        core_loop/
        final_report/
    shared/
        llm_gateway/
            providers/      ← anthropic, openai, google, mistral
        grpc_server/
        messaging/
        audit/
        anonymization/

src/gateway/
    SDLCGateway/        ← Ocelot API gateway (C# .NET)

src/frontend/
    sdlc-ui/            ← Angular dashboard (projects, session, review, audit)

src/services/
    AuditService/
    DocumentService/    ← DiffEngine, DOCX generation, MinIO storage
    SessionService/
    AnonymizationService/

infrastructure/
    elk/
    keycloak/
    minio/
    monitoring/         ← Prometheus + Grafana
    rabbitmq/
    redis/
    sqlserver/
```

---

## Notes

Each agent exposes a gRPC interface and is independently deployable. The gateway routes client requests to the appropriate agent. Documents are stored in MinIO; diffs are computed by DocumentService. The audit trail is consumed by AuditService independently of the agent execution path.
