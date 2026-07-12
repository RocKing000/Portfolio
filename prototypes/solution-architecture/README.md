# Solution Architecture — Enterprise AI Chatbot

A full-stack enterprise chatbot implementation covering an AI service layer, .NET API, Angular frontend, and SQL Server database. The system supports conversational AI, hierarchy browsing, dashboard building, and admin-controlled user flows.

---

## Stack

| Layer | Technology |
|---|---|
| AI Service | Python FastAPI (search, cache, routing, models) |
| API | C# .NET 8 (controllers, services, middleware, endpoints) |
| Frontend | Angular (features, routing, Cypress E2E tests) |
| Database | SQL Server |

---

## Structure

```
AI-service/
    app/
        cache.py            ← Response caching layer
        database.py         ← DB connection and query abstraction
        search/             ← Semantic and keyword search modules
        services/           ← Core AI service logic
        routers/            ← FastAPI route definitions
        models/             ← Data models and schemas

API/
    Controllers/            ← HTTP endpoint controllers
    Services/               ← Business logic layer
    Middleware/             ← Request pipeline (auth, logging)
    Models/                 ← Domain models
    Data/                   ← Data access layer
    Endpoints/              ← Minimal API endpoints

UI/
    src/app/
        core/               ← Guards, services, interceptors
        features/
            admin/          ← Admin controls
            auth/           ← Authentication flows
            signals/        ← Signal and event management
            dashboard-builder/   ← Dashboard configuration UI
            hierarchy-browser/   ← Hierarchical data navigation
        shared/             ← Shared components and utilities
    cypress/                ← End-to-end test suite

Database/
    PROD_01_STRUCTURE.sql   ← Schema DDL
    PROD_02_BUSINESS_DATA.sql ← Reference data
```

---

## Architecture Documentation

Architecture decisions are documented across three layers with implementation guides for backend, database, and frontend. A universal processing strategy document covers the end-to-end design.

---

## Key Engineering Decisions

- AI service is decoupled from the .NET API — each layer scales independently.
- Search is handled by the Python service; CRUD and business logic by the .NET API.
- Hierarchy browsing is a dedicated feature module, not a generic tree component.
- Cypress provides E2E coverage of the core user flows.
