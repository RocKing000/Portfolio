# Dashboard UI/UX Framework — End-to-End Flow (Generic)

Three layers, top to bottom. Each layer's own steps run straight down; the
two connections *between* layers both point the same direction so nothing
crosses.

```mermaid
flowchart TD
    subgraph FE["FRONTEND — one module"]
        direction TB
        FE1["Landing page<br/>(pick a view)"]
        FE2["Shell + N views"]
        FE3["One service<br/>envelope builder · faceted filtering ·<br/>cached prefetch"]
        FE1 --> FE2 --> FE3
    end

    subgraph BE["BACKEND — existing generic dispatcher (unmodified)"]
        direction TB
        BE1["Entry point<br/>(routes by a fixed service code)"]
        BE2["Decrypt request → dispatch → encrypt response"]
        BE3["EXEC dbo.[RequestType]<br/>(RequestType IS the procedure name)"]
        BE1 --> BE2 --> BE3
    end

    subgraph DB["DATABASE — one schema per module"]
        direction TB
        DB1[("Raw table<br/>one row per source record")]
        DB2["RefreshAggregates<br/>runs on every import's last chunk"]
        DB3[("Summary table +<br/>FilterMap table")]
        DB4["Read procs (one per view) +<br/>Import procs"]
        DB1 --> DB2 --> DB3 --> DB4
    end

    FE3 ==>|"Request / response<br/>RequestType = stored procedure name"| BE1
    BE3 ==>|"EXEC proc → JSON result"| DB4
```

**Reading it**: a click in any view flows down through the module's one
service, into the platform's existing generic dispatcher (no module-
specific backend code exists — see `Backend.md`), which executes the stored
procedure whose name **is** the `RequestType` the frontend sent, against
the summary/filter tables that the refresh procedure keeps in sync with the
raw table on every import.

---

## Request/response round trip

A single view request, in time order — a sequence diagram, so nothing can
visually cross regardless of how many steps are added:

```mermaid
sequenceDiagram
    participant V as View component
    participant S as Module service
    participant D as Dispatcher (BL + DAL)
    participant P as Stored procedure
    participant T as Summary / FilterMap tables

    V->>S: request this view's data (filters, basis, ...)
    S->>D: encrypted envelope (RequestType = proc name)
    D->>D: decrypt request
    D->>P: EXEC dbo.[RequestType]
    P->>T: SELECT ... (grouped/pivoted per view)
    T-->>P: rows
    P-->>D: JSON result + response code
    D->>D: encrypt response payload
    D-->>S: encrypted envelope
    S->>S: decrypt payload
    S-->>V: typed rows
```

---

## Import — a separate path

An import does not have to go through the module's own service at all. A
common shape: a dedicated upload flow (in-module or a standalone tool) that
talks to the **same** dispatcher and the **same** procedures every other
request uses.

```mermaid
flowchart TD
    I1["Import entry point<br/>(in-module screen, or a standalone tool)"]
    I2["Chunked upload logic<br/>(parse source file → N row-batches)"]
    I3["Same generic dispatcher<br/>(entry point → BL → DAL)"]
    I4["ImportData proc<br/>(chunked insert)"]
    I5["RefreshAggregates proc<br/>(last chunk only)"]

    I1 --> I2 --> I3 --> I4 --> I5
```

The two flows converge at the same dispatcher and the same refresh step —
an import is what makes the *next* dashboard-view request (the first flow
above) return fresh numbers.
