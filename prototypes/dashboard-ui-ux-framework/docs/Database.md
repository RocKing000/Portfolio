# Dashboard UI/UX Framework — Database Layer (Generic)

This describes the **database layer pattern**: a single-dataset, static-
schema design — one raw table, one pre-aggregated summary table, one
filter-dropdown table, and a small fixed set of stored procedures. No
metadata-driven "dataset engine", no dynamic SQL, no cursors. This shape
assumes the dataset arrives as **bulk imports** (a file at a time), not
row-by-row transactional writes, so the read side can be fully rebuilt on
every import instead of staying live.

Naming below follows `../README.md` §4: `{RawTable}`, `{Module}_Summary`,
`{Module}_FilterMap`, `{Prefix}_*` procedures.

---

## 1. Tables

### 1.1 `{RawTable}` — the raw data

One row per source record, replaced wholesale on every import (never
appended to across imports — see §3).

| Column | Type | Notes |
|---|---|---|
| `Recid` | `BIGINT IDENTITY` | Primary key |
| `Dimension1` … `DimensionN` | `NVARCHAR(…)` | 2–6 hierarchical filter columns (e.g. region → team → sub-team → individual). Each becomes a cross-filtering dropdown. |
| `Category` | `NVARCHAR(20)` | A field with a **small, fixed value domain** (5–10 distinct values) that gets pivoted into columns in grouped views, instead of staying a row-level filter |
| `MeasureA`, `MeasureB`, … | `DECIMAL(18,2)` | Numeric measures. One pair is typically treated as "denominator/numerator" for a bounded ratio metric (see §4.3) |
| `RawStatusField` | `NVARCHAR(100)` | Free-text status column that a computed classification (§5) derives a small fixed set of buckets from |
| `ExclusionFlag1`, `ExclusionFlag2` | `NVARCHAR(20)` | Optional flag columns (e.g. `Y`/blank) that combine with `RawStatusField` to mark a row as excluded from every aggregate |
| `AsOfDate` | `DATE` | The record's own as-of/report date |
| `CreatedDateTime` | `DATETIME` | Audit timestamp |

A derived classification (§5) is **not** a stored column — every procedure
that needs it computes the same `CASE` logic inline, on demand, from the raw
status/flag columns.

**Indexes**

| Index | Keys | Includes | Purpose |
|---|---|---|---|
| Aggregation covering index | leading 1–2 dimension columns most procs filter/group by | every other column any proc reads | Lets the aggregation/rebuild step index-scan a narrow projection instead of the full wide table |
| Dropdown-support indexes | `Category`, `RawStatusField` (+ its flag columns) | — | Index-only scans for dropdowns that have no dimension filter of their own |

### 1.2 `{RawTable}_ImportBatch` — one row per uploaded file

| Column | Type | Notes |
|---|---|---|
| `Recid` | `BIGINT IDENTITY` | Primary key |
| `Owner` | `NVARCHAR(50)` | Whichever top-level scope owns this import (tenant/org/session context) |
| `OriginalFileName` / `FileName` | `NVARCHAR` | As picked by the user / as stored |
| `FileType` | `NVARCHAR(10)` | |
| `UploadedBy` | `NVARCHAR(100)` | |
| `UploadedDate` / `ReportDate` | `DATETIME` / `DATE` | Submission time vs. the business date the data represents |
| `RowCount` | `INT` | Set once the import finishes |
| `Status` | `NVARCHAR(20)` | `Pending` \| `Processing` \| `Success` \| `Failed` |
| `ErrorSummary` | `NVARCHAR(MAX)` | |
| `CreatedDate` | `DATETIME` | |

### 1.3 `{RawTable}_ImportLog` — row-level import errors (rare)

| Column | Type |
|---|---|
| `Recid` | `BIGINT IDENTITY` |
| `BatchId` | `BIGINT` (FK → `ImportBatch.Recid`) |
| `RowNumber` | `INT` |
| `Severity` | `NVARCHAR(10)` (`Error` \| `Warning`) |
| `Message` | `NVARCHAR(500)` |
| `CreatedDate` | `DATETIME` |

### 1.4 `{Module}_Summary` — the one consolidated pre-aggregated table

Grain = the **finest level** any view needs (usually the lowest dimension,
e.g. "individual"). Every grouped view `GROUP BY`s a subset of these columns
at read time instead of each view maintaining its own separately-computed
summary table. A flat "detail" view reads it directly since its own grain
already matches. Rebuilt in full on every import — see §3.

| Column group | Shape | Notes |
|---|---|---|
| Grain | `Dimension1 … DimensionN` | The full dimension set, at the finest grain |
| Freshness | `AsOfDate` | `MAX(AsOfDate)` for this grain's rows |
| Amount basis, per `Category` value + a `Total` | `{Category}_MeasureA_Amount`, `{Category}_MeasureB_Amount`, … | `DECIMAL(18,2)`, real currency/quantity sums scoped to that category |
| Count basis, per `Category` value + a `Total` | `{Category}_MeasureA_Count`, `{Category}_MeasureB_Count`, … | `INT`, row counts scoped to that category |
| Ratio-metric shadow, per `Category` value + a `Total` | `{Category}_NumeratorCE`, `{Category}_DenominatorCE` | See §4.3 |

### 1.5 `{Module}_FilterMap` — distinct dropdown combinations

Backs every filter dropdown without scanning the (potentially huge) raw
table.

| Column | Type |
|---|---|
| `Recid` | `BIGINT IDENTITY` |
| `Dimension1` … `DimensionN` | Same columns as the raw table's dimension set |

`Category`/derived-status dropdowns are **not** sourced from here — both
tend to have a tiny fixed value domain, cheap to `DISTINCT` off the raw
table directly.

**Population must be filtered to match `{Module}_Summary`'s own exclusion
rule** — only rows that aren't excluded (§5) should contribute a
combination. Without this, a dropdown can offer a dimension combination
whose only rows were all excluded; every read proc (which reads from
`Summary`, not the raw table) would then return zero rows for a combination
the dropdown claimed was selectable, with no explanation.

---

## 2. Table relationships

| From | To | Relationship |
|---|---|---|
| `{RawTable}_ImportLog.BatchId` | `{RawTable}_ImportBatch.Recid` | FK |
| `{RawTable}` | `{Module}_Summary` | Rebuilt from, on every import |
| `{RawTable}` | `{Module}_FilterMap` | Rebuilt from, on every import |
| `{RawTable}_ImportBatch` | `{RawTable}` | One row per import; the raw table only ever holds the *current* batch (each import truncates + reloads it) |

No foreign key runs from `{Module}_Summary`/`{Module}_FilterMap` back to the
raw table or to each other — both are independently rebuilt, full-truncate-
and-reinsert, from the same source in the same transaction.

---

## 3. The automated pipeline

Import → refresh is one atomic operation, not a separate scheduled job:

1. `{Prefix}_ImportData` inserts a chunk of rows (see §6). The **first**
   chunk of an import truncates `{RawTable}`; later chunks of the same
   batch append.
2. On the **last** chunk, still inside the same transaction, it runs
   `{Prefix}_RefreshAggregates`.
3. `{Prefix}_RefreshAggregates` truncates and fully rebuilds
   `{Module}_Summary` and `{Module}_FilterMap` from the now-complete raw
   table.
4. The whole thing commits (or rolls back) together — raw data and
   summaries are never inconsistent with each other.

Every dashboard number and every filter dropdown updates the moment an
import finishes; there is no manual "refresh" step anywhere in this
pattern.

---

## 4. Stored procedures

| # | Procedure | Type | Reads | Writes | Purpose |
|---|---|---|---|---|---|
| 1 | `{Prefix}_LoadFilters` | Read | `{Module}_FilterMap`, raw table (`Category`/status only) | — | Every dropdown's options in one call |
| 2 | `{Prefix}_Overview` | Read | `{Module}_Summary` | — | Unfiltered top-level KPI strip + breakdown cards |
| 3 | `{Prefix}_{Dimension}Wise` (× as many as there are useful groupings) | Read | `{Module}_Summary` | — | One row per group, optionally `Category`-pivoted |
| 4 | `{Prefix}_{Grain}Detail` | Read | `{Module}_Summary` | — | Flat row per finest-grain entity |
| 5 | `{Prefix}_SourceData` | Read | `{RawTable}` (direct) | — | Full sortable/filterable raw row browser |
| 6 | `{Prefix}_RefreshAggregates` | Internal helper | `{RawTable}` | `{Module}_Summary`, `{Module}_FilterMap` | Rebuilds every summary/filter table |
| 7 | `{Prefix}_ImportData` | Write | — | `{RawTable}`, `..._ImportBatch`, `..._ImportLog` | Chunked bulk insert + triggers #6 on last chunk |
| 8 | `{Prefix}_GetImportProgress` | Read | `{RawTable}_ImportBatch` | — | Status/resume check for an import |

Every procedure declares the **exact same fixed parameter list** the
backend dispatcher always sends (see `Backend.md` §2) — declaring more or
fewer breaks the generic call path. A small JSON payload parameter carries
whatever extra filters/data don't fit the fixed envelope.

"`Category`-pivoted" means one measure set **per `Category` value** plus a
`Total` set, all in the same row — the ratio metric per cell is typically
computed **client-side**, never in SQL (see `Frontend.md` §5).

### 4.1 `{Prefix}_LoadFilters` — detail

Takes an optional JSON filter (e.g. `{"Dimension1Values": [...]}`) that
narrows dependent dimensions server-side for a first-load call. Returns
every dropdown's options in one response:

| Key | Source | Notes |
|---|---|---|
| One key per dimension (`Dimension1` … `DimensionN`) | `FilterMap` | Optionally narrowed by whichever earlier dimension the caller passed |
| `Category` | Raw table, computed inline | Fixed small-value domain |
| Derived-status key | Raw table, computed inline | Fixed small-value domain |
| `Mapping` | `FilterMap`, **every row, unaggregated** | Raw dimension-combination tuples — lets the frontend compute its own cross-filtering client-side (see `Frontend.md` §4) |

### 4.2 `{Prefix}_ImportData` — chunking contract

| `@Product` field | Type | When required |
|---|---|---|
| `BatchId` | number | Every chunk **except** the first |
| `OriginalFileName`, `FileType`, `ReportDate` | string | First chunk only |
| `IsFirstChunk`, `IsLastChunk` | boolean | Every chunk |
| `Rows` | array of objects | Every chunk |

Behavior:

- First chunk: truncates `{RawTable}`, logs a new `ImportBatch` row
  (`Status = 'Processing'`). Later chunks append to the raw table under
  the same batch.
- **Constant work per chunk** — no classification/update pass runs across
  the whole accumulated batch on the last chunk alone; that shape times out
  on large files.
- **Not idempotent** — a resent chunk (client retry after a timeout) simply
  appends its rows again unless rows carry a batch/chunk identity the
  insert can dedupe against.
- Last chunk: runs `{Prefix}_RefreshAggregates` inside the same
  transaction, then marks the batch `Success` with its final row count.

### 4.3 Bounded ratio-metric design

A ratio metric (e.g. an efficiency/completion percentage) needs a
numerator/denominator pair that's **guaranteed bounded ≤100%** — the
numerator's rows must be a strict subset of the denominator's rows. Two
independent raw measures (e.g. "amount collected" vs. "amount owed") often
are **not** a valid pair for this, since one can legitimately exceed the
other (over-payment, adjustments, etc.) — using them directly can produce a
misleading >100% ratio.

| Basis | Numerator source | Denominator source | Why bounded ≤100% |
|---|---|---|---|
| Count | `{Category}_..._Count`, restricted to the "satisfied" status | `{Category}_..._Count` | The satisfied subset is a strict subset of all rows |
| Amount | `{Category}_MeasureA_Amount`, restricted to the "satisfied" status | `{Category}_MeasureA_Amount` | Both sums are over the same base measure; the satisfied subset is a strict subset of the same rows |

Keep the true, independently-computed measure pair (§1.4's `..._CE` shadow
columns) stored separately for potential future reporting, but **do not**
select them for the display ratio — select the bounded pair above instead.

---

## 5. Classification logic pattern

Computed **inline, on demand**, identically, everywhere it's needed — not
stored per row.

### 5.1 `Category` standardization

Collapse a small number of raw variant spellings into one canonical value
(e.g. several raw strings that all mean "final tier" collapse to one
`Category` value); everything else passes through trimmed/unchanged.

### 5.2 Derived status

| Condition | Derived value |
|---|---|
| Any exclusion flag set, or `RawStatusField` matches an excluded-reason list | `EXCLUDED` |
| `RawStatusField` matches a "fully satisfied" list | `SATISFIED` |
| `RawStatusField` matches a "partially satisfied" list | `PARTIAL` |
| anything else | `UNRESOLVED` |

`EXCLUDED` rows are dropped before aggregation and before `FilterMap`
population — they're never counted in any dashboard number — but a raw
row-browser view still returns them so users can see *why* a row is
excluded.

---

## 6. Raw import → DB column mapping pattern

An import proc's typed-parse step should map each **incoming field name**
(whatever the source file/API actually calls it) to its own, possibly
differently-named, DB column:

| Import field | DB column | Type note |
|---|---|---|
| *(source header 1)* | `Dimension1` | |
| *(source header 2)* | `Dimension2` | |
| … | … | |
| *(source header for a numeric field)* | `MeasureA` | Parse as text, then per-row safe-cast to the numeric type — a typed parse that hard-fails the whole chunk on one bad cell is the wrong tradeoff for bulk import data (real files contain non-numeric junk in numeric-looking columns) |
| *(source header for a date field)* | `AsOfDate` | Same per-row safe-cast reasoning |

Any column beyond the known/expected set that a source file happens to
include should be **ignored**, not captured into a catch-all column — an
unbounded "capture anything" column defeats a static, typed schema.

---

## 7. Deployment

1. Run the schema script (idempotent — create-if-not-exists; safe to
   re-run).
2. Run the stored-procedure script (idempotent — create-or-alter).
3. A **schema/proc change alone does not touch existing data.** If a fix
   changes what `{Prefix}_RefreshAggregates` computes, the stored data only
   picks it up after either a new import (which calls it automatically) or
   manually re-running it.
