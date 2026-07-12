# DIRE-X — Setup & Deployment Guide

## Quick Start (Local)

### 1. Clone & Install
```bash
cd dire-x
npm run install:all
```

### 2. Configure Server
```bash
cp server/.env.example server/.env
# Fill in: SUPABASE_URL, SUPABASE_ANON_KEY, OPENROUTER_API_KEY
```

### 3. Seed Database (optional — works without it via in-memory fallback)
```bash
npm run seed
```

### 4. Run
```bash
npm run dev
# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
# Health:   http://localhost:4000/health
```

---

## Deployment

### Frontend → Vercel
```bash
cd client
vercel --prod
# Set env var: VITE_API_URL = https://your-backend.onrender.com
```

### Backend → Render
1. Push to GitHub
2. Connect repo on render.com
3. Set root dir to `server/`
4. Build: `npm install` | Start: `npm start`
5. Add env vars from `server/.env.example`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /api/companies | All companies |
| POST | /api/simulate | Run simulation step |
| GET | /api/world-state | World state |
| POST | /api/world-state/tick | Advance world day |
| POST | /api/create-company | Create new company |
| GET | /api/leaderboard | Rankings |
| GET | /api/gdp | GDP global ranking |
| GET | /api/geopolitical/relations/:country | Nation relations |
| GET | /api/geopolitical/snapshot | Global relations map |
| GET | /api/health/:country | Health/literacy data |
| GET | /api/health/all | All countries social data |
| GET | /api/compliance/:companyId | Compliance profile |
| GET | /api/strategic/:companyId | Strategic actions |
| GET | /api/economy/market | Market state |
| GET | /api/geo/countries | Country geo data |
| GET | /api/geo/trade-routes | Trade routes |

---

## Key Architecture

- **Simulation**: Fully deterministic, no randomness in formulas
- **AI Narration**: OpenRouter (free tier) with template fallback
- **Database**: Supabase for persistent data, in-memory for runtime state
- **Cron**: Daily ingestion at 00:00 UTC (scheduler.js)
- **Sound**: Web Audio API, no external deps

## SRES Formula
```
SRES_r = 0.35×D + 0.30×S + 0.20×G + 0.15×E
Company SRES = weighted average across all resources
```
