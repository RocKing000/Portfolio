# Backend Architecture
## Hybrid .NET 8.0 + Python 3.11 FastAPI Design

---

## Architectural Overview

The backend is a **hybrid runtime** combining two distinct runtimes with complementary strengths:

| Runtime | Framework | Responsibility |
|---|---|---|
| .NET 8.0 | ASP.NET Core | Business logic, API gateway, auth, caching, orchestration |
| Python 3.11 | FastAPI | AI/ML workloads: classification, anomaly detection, forecasting, recommendations |

Both services communicate via REST over internal networking. The .NET service is the **system of record** for all business operations; the Python service is **enhancement-only** — the system must function correctly if the Python service is unavailable.

---

## Per-User Connection Management

### Design Principle
Connection limits are enforced **per user**, not globally. A single heavy user cannot exhaust the connection pool and deny service to others.

### Specification
- **Maximum concurrent queries per user:** 2
- **Enforcement mechanism:** `SemaphoreSlim` per user identity
- **Scope:** Applies to all database-bound operations

### UserConnectionTracker Implementation

```csharp
public class UserConnectionTracker
{
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _userSemaphores = new();
    private const int MaxConcurrentQueriesPerUser = 2;

    public SemaphoreSlim GetOrCreateSemaphore(string userId)
    {
        return _userSemaphores.GetOrAdd(
            userId,
            _ => new SemaphoreSlim(MaxConcurrentQueriesPerUser, MaxConcurrentQueriesPerUser)
        );
    }

    public async Task<T> ExecuteWithUserLockAsync<T>(
        string userId,
        Func<Task<T>> operation,
        CancellationToken cancellationToken = default)
    {
        var semaphore = GetOrCreateSemaphore(userId);
        await semaphore.WaitAsync(cancellationToken);
        try
        {
            return await operation();
        }
        finally
        {
            semaphore.Release();
        }
    }
}
```

### Registration
```csharp
// Program.cs
builder.Services.AddSingleton<UserConnectionTracker>();
```

---

## Data Access & Caching Strategy

### Cache-First Pattern

All read operations follow a strict cache-first sequence:

```
Request
  └── Check Redis (distributed cache)
        ├── HIT  → Return cached data (< 5ms)
        └── MISS → Check Memory Cache (local)
                    ├── HIT  → Return + backfill Redis
                    └── MISS → Query SQL Server (< 100ms)
                                └── Store in Memory Cache + Redis → Return
```

### Cache Configuration

| Layer | Technology | TTL | Scope |
|---|---|---|---|
| L1 | In-Memory (`IMemoryCache`) | 5 minutes | Per-instance |
| L2 | Redis | 30 minutes | Distributed |
| L3 | SQL Server | — | Source of truth |

### Cache Hit Rate Target: 90%+

### Optimistic Writes
Write operations update the database first, then invalidate (not update) cache entries. Cache entries are re-populated on next read — avoids write amplification and stale-on-failure scenarios.

```csharp
public async Task UpdateDashboardLayoutAsync(string userId, DashboardLayout layout)
{
    // 1. Write to DB
    await _repository.UpdateAsync(layout);

    // 2. Invalidate all cache keys for this user's layouts
    await _cache.RemoveAsync(CacheKeys.UserLayouts(userId));
    _memoryCache.Remove(CacheKeys.UserLayouts(userId));
}
```

---

## Repository Pattern

### ADO.NET Direct Access
The repository layer uses **ADO.NET directly** — no ORM overhead on the hot path. Entity Framework is used only for migrations.

```csharp
public class DashboardLayoutRepository : IDashboardLayoutRepository
{
    private readonly string _connectionString;

    public async Task<IEnumerable<DashboardLayout>> GetByUserIdAsync(string userId)
    {
        const string sql = @"
            SELECT layout_id, user_id, layout_name, grid_config, is_active, created_at
            FROM dashboard_layouts
            WHERE user_id = @UserId AND deleted_at IS NULL
            ORDER BY created_at DESC";

        await using var conn = new SqlConnection(_connectionString);
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@UserId", userId);

        await conn.OpenAsync();
        // ... map results
    }
}
```

### Repository Rules
- All queries must use parameterized SQL (no string concatenation)
- All queries must complete in < 100ms on indexed columns
- No stored procedures — CRUD operations only
- Each module has its own repository scoped to its database

---

## Python AI/ML Integration

### Service Architecture

The Python FastAPI service exposes 4 operational modules as REST endpoints:

```
POST /classify          → Signal Classification
POST /detect-anomalies  → Anomaly Detection
POST /forecast          → Signal Forecasting
POST /recommend-rules   → Rule Recommendations
```

### Module Specifications

#### Signal Classification
- **Algorithms:** Random Forest (primary), Neural Networks (secondary/ensemble)
- **Input:** Raw signal payload with features vector
- **Output:** Classification label + confidence score
- **Fallback:** Rules-based classifier if model unavailable

#### Anomaly Detection
- **Algorithms:** Isolation Forest (online), Autoencoders (batch)
- **Input:** Signal time-series window (configurable, default 24h)
- **Output:** Anomaly flag, score, and contributing features
- **Threshold:** Configurable per signal type

#### Forecasting
- **Algorithms:** LSTM (long-range), Prophet (short-range with seasonality)
- **Input:** Historical signal data, forecast horizon
- **Output:** Predicted values + confidence intervals
- **Retraining:** Scheduled weekly or on drift detection

#### Rule Recommendation
- **Algorithm:** Association Rules (Apriori/FP-Growth)
- **Input:** Historical resolution actions and outcomes
- **Output:** Ranked list of recommended resolution rules
- **Min Support/Confidence:** Configurable per tenant

### .NET → Python Communication

```csharp
public class PythonMLService : IPythonMLService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<PythonMLService> _logger;

    public async Task<ClassificationResult> ClassifySignalAsync(SignalPayload payload)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync("/classify", payload);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<ClassificationResult>()!;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ML service unavailable, falling back to rules classifier");
            return _rulesClassifier.Classify(payload); // Fallback
        }
    }
}
```

---

## API Design

### Principles
- RESTful resource-based URLs
- Standard HTTP verbs: GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove)
- All responses wrapped in a consistent envelope
- Versioning via URL prefix: `/api/v1/`

### Standard Response Envelope
```json
{
  "success": true,
  "data": { },
  "error": null,
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "uuid-v4"
}
```

### Core Endpoints (14+)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/users/{id}` | Get user profile |
| GET | `/api/v1/dashboards` | List user's dashboards |
| POST | `/api/v1/dashboards` | Create new dashboard layout |
| PUT | `/api/v1/dashboards/{id}` | Replace dashboard layout |
| PATCH | `/api/v1/dashboards/{id}` | Update dashboard fields |
| DELETE | `/api/v1/dashboards/{id}` | Soft-delete dashboard |
| GET | `/api/v1/widgets` | List widget configurations |
| POST | `/api/v1/widgets` | Create widget config |
| GET | `/api/v1/signals` | Query signals with filters |
| POST | `/api/v1/signals/classify` | Classify a signal (proxies ML) |
| GET | `/api/v1/analytics/anomalies` | Get detected anomalies |
| GET | `/api/v1/analytics/forecast` | Get signal forecasts |
| GET | `/api/v1/powerbi/token` | Get Power BI embed token |
| GET | `/api/v1/health` | Health check (all modules) |

---

## Authentication & Authorization

### JWT Stateless Tokens
- **Algorithm:** RS256 (asymmetric)
- **Access Token TTL:** 15 minutes
- **Refresh Token TTL:** 7 days (stored in HTTP-only cookie)
- **Claims:** `userId`, `email`, `roles`, `modules[]`

### Role-Based Authorization
```csharp
[Authorize(Policy = "DashboardAdmin")]
[HttpPost("api/v1/dashboards")]
public async Task<IActionResult> CreateDashboard([FromBody] CreateDashboardRequest request)
```

### Policies
| Policy | Roles Required |
|---|---|
| `DashboardAdmin` | `admin`, `dashboard_manager` |
| `AnalyticsRead` | `admin`, `analyst`, `viewer` |
| `CRMWrite` | `admin`, `crm_manager` |
| `LoanApprover` | `admin`, `loan_officer` |

---

## Middleware Pipeline

```
Request → HTTPS Redirection
       → CORS
       → Rate Limiting (per-user token bucket)
       → Request Logging (Serilog correlation ID)
       → Authentication (JWT validation)
       → Authorization
       → Exception Handling (global)
       → Controller Action
       → Response Caching Headers
       → Response Logging
```

### Rate Limiting
- Default: 100 requests/minute per user
- Burst: 200 requests/minute (30-second window)
- Exceeded: HTTP 429 with `Retry-After` header

---

## Logging & Monitoring

### Serilog Configuration
```csharp
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Application", "SignalDashboard")
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {CorrelationId} {Message}{NewLine}{Exception}")
    .WriteTo.ApplicationInsights(TelemetryConfiguration.Active, TelemetryConverter.Traces)
    .CreateLogger();
```

### Structured Log Fields
Every log entry includes: `CorrelationId`, `UserId`, `Module`, `Duration`, `CacheHit`

### Application Insights Metrics
- Request duration histogram
- Cache hit/miss ratio
- ML service availability
- Per-user query counts
- Error rate by module

---

## Performance Characteristics

| Metric | Target | Notes |
|---|---|---|
| Throughput | 1,000+ QPS | At 90% cache hit rate |
| p50 Latency | < 50ms | Cache hit path |
| p95 Latency | < 200ms | DB query path |
| p99 Latency | < 500ms | Complex aggregations |
| Cache Hit Rate | ≥ 90% | Redis + Memory |
| DB Query Time | < 100ms | Indexed queries only |
| Startup Time | < 30s | Cold start |
| Scalability | Linear | Stateless; scale by adding instances |

---

## Technology Stack Summary

| Component | Technology | Version |
|---|---|---|
| Business Logic Runtime | .NET / ASP.NET Core | 8.0 |
| ML Runtime | Python / FastAPI | 3.11 / latest |
| ORM (migrations only) | Entity Framework Core | 8.x |
| Data Access (runtime) | ADO.NET | Built-in |
| Distributed Cache | Redis | 7.x |
| Local Cache | IMemoryCache | Built-in |
| Authentication | JWT (RS256) | Built-in |
| Logging | Serilog | Latest |
| Monitoring | Application Insights | Azure SDK |
| Container | Docker | Latest |

---

*Document classification: Internal — Architecture*  
*Layer: Backend | Version: 1.0*
