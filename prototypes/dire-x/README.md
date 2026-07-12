# DIRE-X — Dynamic Intelligence & Risk Engine

A geopolitics and supply chain risk simulation built independently on a problem statement from Smart India Hackathon 2025. Not submitted to the hackathon. Models country-to-company resource dependencies and scores entity risk across geopolitical, supply, demand, and environmental dimensions simultaneously.

---

## What It Does

DIRE-X models a network of countries, companies, and strategic resources. It tracks dependencies between them — which countries supply which resources, which companies depend on which supply chains — and computes a live risk score for each entity as conditions change.

The core scoring mechanism is SRES (Strategic Resource Evaluation Score): a multi-dimensional index that aggregates supply pressure, demand dynamics, geopolitical tension, and environmental factors into a single entity-level score, updated as simulation state changes.

---

## Scale

- 92 countries modelled
- 80+ companies across key sectors
- 15 strategic resources
- 7 crisis types
- 84 API endpoints
- 20 simulation engines

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React / Vite |
| Backend | Node.js |
| AI Service | Python FastAPI |
| Database | PostgreSQL (Supabase) |
| Deployment | Vercel (frontend) |

---

## Demo

[dire-x.vercel.app](https://dire-x.vercel.app)
