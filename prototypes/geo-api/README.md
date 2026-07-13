# geo-api

A Next.js API service that ingests employee GPS attendance data (parsed from PDF exports) and exposes structured endpoints for location tracking and compliance analysis.

---

## What It Does

Takes attendance records — each containing a timestamp and GPS coordinate — and computes per-employee and branch-level compliance metrics: attendance rate, late check-ins, off-hours activity, and GPS spoofing detection (static coordinates across all records).

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/employees` | List all employees with latest location and record count |
| GET | `/api/employees/:id` | Full employee profile with complete attendance history |
| GET | `/api/stats` | Aggregate compliance report: per-employee flags, risk scores, branch centroids |

### Stats response shape

```json
{
  "summary": {
    "totalEmployees": 3,
    "avgAttendanceRate": 72,
    "highRiskCount": 1,
    "avgRiskScore": 34,
    "totalFlags": 4
  },
  "employees": [
    {
      "id": "1003",
      "attendanceRate": 28,
      "level": "CRITICAL",
      "flags": [
        { "code": "LOW_ATTENDANCE", "severity": "CRITICAL", "message": "..." },
        { "code": "FREQUENT_LATE",  "severity": "HIGH",     "message": "..." }
      ]
    }
  ],
  "branches": [
    { "branch": "Branch South", "lat": 13.08, "lng": 80.27, "avgAttendance": 28 }
  ]
}
```

### Compliance flags

| Code | Trigger | Severity |
|------|---------|----------|
| `LOW_ATTENDANCE` | Attendance rate < 60% | CRITICAL / HIGH |
| `BELOW_AVG_ATTENDANCE` | Rate 60–80% | MEDIUM |
| `FREQUENT_LATE` | >30% check-ins after 09:00 | MEDIUM / HIGH |
| `OFF_HOURS` | Any check-in after 18:00 | LOW |
| `STATIC_GPS` | All coordinates identical (>3 records) | MEDIUM |

---

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Runtime | Node.js |
| Deployment | Vercel |

---

## Structure

```
app/
  api/
    employees/route.ts        — list endpoint
    employees/[id]/route.ts   — detail endpoint
    stats/route.ts            — compliance report
data/
  employees.ts                — employee + attendance records (sample data here)
middleware.ts                 — CORS for all /api/* routes
```

---

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000/api/stats](http://localhost:3000/api/stats) to see the compliance report.

---

## Data

`data/employees.ts` in this public copy contains three synthetic sample records. The production version loads real attendance data parsed from daily PDF exports. Real employee and organisational data is kept private.
