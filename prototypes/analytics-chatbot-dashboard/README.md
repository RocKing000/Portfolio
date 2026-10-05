# Analytics Dashboard with Integrated Chatbot

An Angular dashboard module for analytics with an integrated AI chat assistant. Combines a data-driven dashboard surface with a live chat interface that calls a remote AI backend, with an offline fallback for when the backend is unavailable.

---

## Architecture

| Layer | Stack |
|---|---|
| Frontend | Angular |
| Chat interface | Integrated AI chat assistant component |
| Backend | Remote AI service (REST) |
| Offline mode | Local fallback when backend is unreachable |

---

## Features

- Multi-view analytics dashboard with configurable data displays
- Embedded AI chat assistant for contextual queries against the displayed data
- Remote backend integration with graceful offline fallback
- Modular component structure: dashboard views and chat panel are independently replaceable
