# Database Architecture
## SQL Server 2022 Enterprise — Per-User Constraints & CRUD-Only Model

---

## Database Overview

The database layer is designed as a **pure source of truth** — it stores and retrieves data, and does nothing else. All business logic lives in the application tier.

| Property | Specification |
|---|---|
| Engine | SQL Server 2022 Enterprise |
| HA Strategy | Always On Availability Groups (3 replicas) |
| Replication | Synchronous (primary + 1 secondary), Asynchronous (DR replica) |
| Design Philosophy | Source of truth — data only, no logic |
| Query Model | CRUD only (no stored procedures, no triggers) |
| Architecture Pattern | Database-per-module (V2.0) |
| Key Constraint | All indexed queries must complete in < 100ms |

---

## High Availability Configuration

### Always On Availability Groups (AG)

```
Primary Replica (Read/Write)
  ├── Secondary Replica 1 — Synchronous (failover candidate)
  ├── Secondary Replica 2 — Synchronous (read-scale + failover candidate)
  └── DR Replica         — Asynchronous (disaster recovery, different datacenter)
```

### Failover Characteristics
- **Automatic failover:** Yes (synchronous replicas only)
- **RTO target:** < 30 seconds
- **RPO target:** Zero (synchronous) / < 5 minutes (DR async)
- **Read routing:** Read-only workloads routed to secondary replicas via AG listener

---

## Design Philosophy

### Source of Truth Principles
1. **No stored procedures** — all query logic lives in the application repository layer
2. **No triggers for business logic** — triggers only permitted for audit timestamp updates
3. **No computed business rules in views** — views are for query convenience only
4. **Stateless design** — no session state, no temporary tables for user sessions
5. **JSON for flexible schema** — variable-structure data stored as `NVARCHAR(MAX)` JSON

### Why CRUD-Only
- Stored procedures create hidden coupling between database and application
- Business logic in the DB is untestable by unit tests
- Schema migrations become complex when logic is embedded
- Application-layer logic can be cached, versioned, and deployed independently

---

## Module-Per-Database Architecture (V2.0)

Each platform module owns its own database. No cross-database JOINs. Cross-module data access is via API calls only.

```
signal_infrastructure   ← Auth, Users, Audit, Global Config
signal_dashboard        ← Dashboard Layouts, Widget Configs
signal_analytics        ← Signals, Signal Aggregations
signal_crm              ← Customer Records, Interactions
signal_loan             ← Loan Records, Decisions
signal_shared           ← Shared cache metadata (read-only mirror patterns)
```

### Module Independence Test
A module passes the independence test if:
- [ ] Its database can be restored independently
- [ ] Its service starts with no other module running
- [ ] Its data is not referenced by foreign key from another module's DB
- [ ] A failure in it does not cascade to other modules

---

## Primary Entity Tables

### Infrastructure Module (`signal_infrastructure`)

#### `users`
```sql
CREATE TABLE users (
    user_id         UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    email           NVARCHAR(256)       NOT NULL,
    display_name    NVARCHAR(100)       NOT NULL,
    role            NVARCHAR(50)        NOT NULL,
    is_active       BIT                 NOT NULL DEFAULT 1,
    created_at      DATETIME2(7)        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(7)        NOT NULL DEFAULT SYSUTCDATETIME(),
    deleted_at      DATETIME2(7)        NULL,
    CONSTRAINT PK_users PRIMARY KEY CLUSTERED (user_id),
    CONSTRAINT UQ_users_email UNIQUE (email)
);
CREATE NONCLUSTERED INDEX IX_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE NONCLUSTERED INDEX IX_users_role ON users (role) WHERE deleted_at IS NULL;
```

#### `audit_log`
```sql
CREATE TABLE audit_log (
    audit_id        UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    user_id         UNIQUEIDENTIFIER    NOT NULL,
    action          NVARCHAR(100)       NOT NULL,
    entity_type     NVARCHAR(100)       NOT NULL,
    entity_id       NVARCHAR(100)       NULL,
    old_value       NVARCHAR(MAX)       NULL,  -- JSON
    new_value       NVARCHAR(MAX)       NULL,  -- JSON
    ip_address      NVARCHAR(45)        NULL,
    created_at      DATETIME2(7)        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_audit_log PRIMARY KEY CLUSTERED (audit_id)
);
CREATE NONCLUSTERED INDEX IX_audit_user_created ON audit_log (user_id, created_at DESC);
```

#### `global_config`
```sql
CREATE TABLE global_config (
    config_key      NVARCHAR(200)       NOT NULL,
    config_value    NVARCHAR(MAX)       NOT NULL,  -- JSON or scalar
    description     NVARCHAR(500)       NULL,
    updated_at      DATETIME2(7)        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by      UNIQUEIDENTIFIER    NULL,
    CONSTRAINT PK_global_config PRIMARY KEY CLUSTERED (config_key)
);
```

---

### Dashboard Module (`signal_dashboard`)

#### `dashboard_layouts`
```sql
CREATE TABLE dashboard_layouts (
    layout_id       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    user_id         UNIQUEIDENTIFIER    NOT NULL,
    layout_name     NVARCHAR(100)       NOT NULL,
    grid_config     NVARCHAR(MAX)       NOT NULL,  -- JSON: grid positioning
    is_active       BIT                 NOT NULL DEFAULT 0,
    is_default      BIT                 NOT NULL DEFAULT 0,
    created_at      DATETIME2(7)        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(7)        NOT NULL DEFAULT SYSUTCDATETIME(),
    deleted_at      DATETIME2(7)        NULL,
    CONSTRAINT PK_dashboard_layouts PRIMARY KEY CLUSTERED (layout_id)
);
CREATE NONCLUSTERED INDEX IX_layouts_user ON dashboard_layouts (user_id) WHERE deleted_at IS NULL;
```

**Constraint:** Maximum 5 layouts per user — enforced at the application layer before INSERT.

#### `widget_configs`
```sql
CREATE TABLE widget_configs (
    widget_id       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    layout_id       UNIQUEIDENTIFIER    NOT NULL,
    user_id         UNIQUEIDENTIFIER    NOT NULL,
    widget_type     NVARCHAR(100)       NOT NULL,
    position        NVARCHAR(MAX)       NOT NULL,  -- JSON: {row, col, width, height}
    config          NVARCHAR(MAX)       NOT NULL,  -- JSON: widget-specific config
    is_locked       BIT                 NOT NULL DEFAULT 0,
    created_at      DATETIME2(7)        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(7)        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_widget_configs PRIMARY KEY CLUSTERED (widget_id)
);
CREATE NONCLUSTERED INDEX IX_widgets_layout ON widget_configs (layout_id);
CREATE NONCLUSTERED INDEX IX_widgets_user ON widget_configs (user_id);
```

---

### Analytics Module (`signal_analytics`)

#### `signals`
```sql
CREATE TABLE signals (
    signal_id       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    signal_type     NVARCHAR(100)       NOT NULL,
    source          NVARCHAR(200)       NOT NULL,
    severity        TINYINT             NOT NULL,  -- 1=Low, 2=Medium, 3=High, 4=Critical
    status          NVARCHAR(50)        NOT NULL DEFAULT 'open',
    payload         NVARCHAR(MAX)       NOT NULL,  -- JSON: raw signal data
    metadata        NVARCHAR(MAX)       NULL,      -- JSON: classification + ML outputs
    occurred_at     DATETIME2(7)        NOT NULL,
    resolved_at     DATETIME2(7)        NULL,
    created_at      DATETIME2(7)        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_signals PRIMARY KEY CLUSTERED (signal_id)
);
CREATE NONCLUSTERED INDEX IX_signals_type_occurred ON signals (signal_type, occurred_at DESC);
CREATE NONCLUSTERED INDEX IX_signals_severity ON signals (severity, status) WHERE status = 'open';
CREATE NONCLUSTERED INDEX IX_signals_source ON signals (source, occurred_at DESC);
```

#### `signal_aggregations`
```sql
CREATE TABLE signal_aggregations (
    agg_id          UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    signal_type     NVARCHAR(100)       NOT NULL,
    period_start    DATETIME2(7)        NOT NULL,
    period_end      DATETIME2(7)        NOT NULL,
    period_type     NVARCHAR(20)        NOT NULL,  -- 'hourly', 'daily', 'weekly'
    count           INT                 NOT NULL DEFAULT 0,
    avg_severity    DECIMAL(5,2)        NULL,
    stats           NVARCHAR(MAX)       NULL,      -- JSON: min/max/percentiles
    created_at      DATETIME2(7)        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_signal_aggregations PRIMARY KEY CLUSTERED (agg_id)
);
CREATE NONCLUSTERED INDEX IX_agg_type_period ON signal_aggregations (signal_type, period_start, period_type);
```

---

## Architectural Governance Rules

### Non-Negotiables
1. **CRUD Only** — No stored procedures, no triggers for business logic
2. **No cross-database JOINs** — data sharing via API calls only
3. **All indexed queries < 100ms** — any query exceeding this must be refactored before merge
4. **No hardcoded GUIDs or constants** — all references via FK or config table
5. **Soft deletes** — `deleted_at` timestamp instead of physical DELETE on primary entities
6. **UTC timestamps only** — all `DATETIME2` columns store UTC; display conversion in application

### Schema Standards
| Standard | Rule |
|---|---|
| Primary Keys | `UNIQUEIDENTIFIER` with `NEWSEQUENTIALID()` |
| Timestamps | `DATETIME2(7)` UTC; never `DATETIME` |
| Strings | `NVARCHAR` (Unicode); `VARCHAR` only for ASCII-guaranteed fields |
| JSON Storage | `NVARCHAR(MAX)` — never `TEXT` or `XML` for JSON |
| Boolean | `BIT` — never `TINYINT` or `CHAR` |
| Decimals | `DECIMAL(precision, scale)` — never `FLOAT` for money/metrics |

---

## Index Strategy

### Indexing Principles
- Every foreign-key-like column (e.g., `user_id`) must have a non-clustered index
- Partial indexes (`WHERE deleted_at IS NULL`) preferred for soft-delete patterns
- Composite indexes: most selective column first
- No more than 5 non-clustered indexes per table — index bloat degrades write performance

### Index Naming Convention
```
IX_{table}_{columns}        Non-clustered index
UQ_{table}_{columns}        Unique constraint
PK_{table}                  Primary key
```

---

## Backup & Recovery

| Backup Type | Frequency | Retention |
|---|---|---|
| Full | Daily (02:00 UTC) | 30 days |
| Differential | Every 6 hours | 7 days |
| Transaction Log | Every 15 minutes | 3 days |
| AG Snapshot | Weekly | 4 weeks |

### Recovery Targets
- **RTO (Recovery Time Objective):** < 30 minutes for full restore
- **RPO (Recovery Point Objective):** < 15 minutes (transaction log frequency)

---

## Per-Module Connection Management

Each module uses an **independent connection pool**. This prevents one module's connection exhaustion from affecting others.

```json
{
  "signal_infrastructure": {
    "connectionString": "Server=...;Database=signal_infrastructure;...",
    "minPoolSize": 5,
    "maxPoolSize": 50
  },
  "signal_dashboard": {
    "connectionString": "Server=...;Database=signal_dashboard;...",
    "minPoolSize": 5,
    "maxPoolSize": 30
  },
  "signal_analytics": {
    "connectionString": "Server=...;Database=signal_analytics;...",
    "minPoolSize": 10,
    "maxPoolSize": 100
  }
}
```

---

## Security & Access Control

- Each module database has its own **SQL login** with minimal permissions
- Application login has: `SELECT`, `INSERT`, `UPDATE`, `DELETE` only — no `ALTER`, `DROP`, `EXEC`
- SA account disabled; all admin operations via a named DBA account
- Active Directory integration for human access (no shared passwords)
- Transparent Data Encryption (TDE) enabled on all databases
- Row-Level Security (RLS) applied to multi-tenant tables where applicable

---

*Document classification: Internal — Architecture*  
*Layer: Database | Version: 2.0*
