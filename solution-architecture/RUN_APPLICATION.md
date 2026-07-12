# Application Startup Guide

## Architecture Overview

```
Browser (Angular :4200)
    └── POST /api/v2/search  ──►  .NET API (:5195)
                                      └── POST /search  ──►  Python AI Service (:8000)
                                                                 └── SQL Server (YOUR_DB_NAME)
                                                                 └── sentence-transformers (all-MiniLM-L6-v2)
```

Three services must run simultaneously. Start them in this order:
1. Python AI Service — hybrid search (port 8000)
2. .NET API (port 5195)
3. Angular UI (port 4200)

---

## Prerequisites

| Tool | Required Version | Check |
|------|-----------------|-------|
| Python | 3.11 | `python --version` |
| .NET SDK | 8.0 | `dotnet --version` |
| Node.js | 18+ | `node --version` |
| SQL Server | Running | SSMS → connect to `YOUR_DB_SERVER\YOUR_DB_INSTANCE` |

---

## First-Time Setup (One-time only)

### Python AI Service — create venv and install
```powershell
cd "d:\Solution Architecture\Implementation\Execution\ai-service"
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
deactivate
```
> First run downloads the embedding model (~90 MB). Much faster than before.

### .NET API — restore packages
```powershell
cd "d:\Solution Architecture\Implementation\Execution\API"
dotnet restore
```

### Angular UI — install packages
```powershell
cd "d:\Solution Architecture\Implementation\Execution\UI"
npm install
```

---

## Service 1 — Python AI Service (Port 8000)

Open **Terminal 1**

```powershell
cd "d:\Solution Architecture\Implementation\Execution\ai-service"
venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Wait for this before moving on:**
```
INFO:     Application startup complete.
```

**Verify:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health"
```
Expected: `status: healthy, database: connected`

---

## Service 2 — .NET API (Port 5195)

Open **Terminal 2**

```powershell
cd "d:\Solution Architecture\Implementation\Execution\API"
dotnet run
```

**Verify:**
```powershell
Invoke-RestMethod -Uri "http://localhost:5195/health"
```

Swagger UI: `http://localhost:5195/swagger`

---

## Service 3 — Angular UI (Port 4200)

Open **Terminal 3**

```powershell
cd "d:\Solution Architecture\Implementation\Execution\UI"
npm start
```

Open browser at: **http://localhost:4200**

---

## Configuration Files

### Python AI Service — `.env`
Path: `ai-service/.env`

```env
DB_SERVER=YOUR_DB_SERVER\YOUR_DB_INSTANCE
DB_USER=YOUR_DB_USER
DB_PASSWORD=YOUR_DB_PASSWORD
DB_NAME=YOUR_DB_NAME
DB_PORT=1433
API_HOST=0.0.0.0
API_PORT=8000
SIMILARITY_THRESHOLD=0.3
```

### .NET API — `appsettings.json`
Path: `API/appsettings.json`

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=YOUR_DB_SERVER\\YOUR_DB_INSTANCE;Initial Catalog=YOUR_DB_NAME;User ID=YOUR_DB_USER;Password=YOUR_DB_PASSWORD;"
  },
  "MLService": {
    "BaseUrl": "http://localhost:8000",
    "TimeoutSeconds": 5
  }
}
```

---

## Database Setup (One-time)

Run these SQL scripts in SSMS against `YOUR_DB_NAME` in order:

| Order | File | Purpose |
|-------|------|---------|
| 1 | `01_CLEANUP_AND_CREATE_V2.sql` | Create schema |
| 2 | `02_stored_procedures_v2.sql` | Stored procedures |
| 3 | `03_seed_data_v2.sql` | Tenants, users |
| 4 | `06_kb_schema_and_tables.sql` | KB tables |
| 5 | `07_add_ml_automation_columns.sql` | ML columns |
| 6 | `15_kb_[chatbot]_errors.sql` | Base errors |
| 7 | `16_kb_[chatbot]_actual_errors.sql` | Real errors

---

## Useful Commands

### Flush search cache (after DB changes)
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/reload-cache" -Method POST
```

### Test AI search directly
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/search" -Method POST `
  -ContentType "application/json" `
  -Body '{"query":"K-100","tenant_code":"FEDERAL","max_results":5}'
```

### Test search via .NET API
```powershell
Invoke-RestMethod -Uri "http://localhost:5195/api/v2/search" -Method POST `
  -ContentType "application/json" `
  -Body '{"query":"K-100","tenantCode":"FEDERAL","limit":5}'
```

### Check active errors in DB
```sql
SELECT COUNT(*) FROM kb.error_library WHERE is_active = 1;
SELECT error_code, error_title, severity FROM kb.error_library WHERE is_active = 1 ORDER BY category;
```

---

## Login Credentials

Default password for all accounts: **`EnterpriseChatbot@2026`**

| Username | Password | Role |
|----------|----------|------|
| `fed_platform_admin` | `EnterpriseChatbot@2026` | Platform Admin |
| `fed_support` | `EnterpriseChatbot@2026` | Support Team |
| `rajesh.kumar` | `EnterpriseChatbot@2026` | Agent |
| `priya.sharma` | `EnterpriseChatbot@2026` | Agent |

> Passwords seeded by `Database/04_seed_passwords.sql`.

**To reset a password:**
```powershell
$username = "fed_platform_admin"
$password = "EnterpriseChatbot@2026"
$bytes = [System.Text.Encoding]::ASCII.GetBytes("$username$password")
$hash = [System.Security.Cryptography.MD5]::Create().ComputeHash($bytes)
($hash | ForEach-Object { $_.ToString("X2") }) -join '-'
```
Paste the output into the `password_hash` column in `infrastructure.users`.

---

## Shutdown

```
Terminal 1 (Python):  Ctrl+C  →  then type: deactivate
Terminal 2 (.NET):    Ctrl+C
Terminal 3 (Angular): Ctrl+C
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ModuleNotFoundError` on Python startup | Dependencies not installed | `pip install -r requirements.txt` inside venv |
| Search returns empty array | No matching errors in DB | Run `16_kb_[chatbot]_actual_errors.sql` |
| Search returns empty array | In-memory cache stale | `POST /reload-cache` |
| First search is slow (up to 30s) | Embedding model cold start | Normal — subsequent searches are fast |
| `.NET API 500 error` | Python service not running | Start Terminal 1 first |
| Angular CORS error | .NET API not running | Start Terminal 2 first |
| Login fails | Wrong credentials | Check `infrastructure.users` table |