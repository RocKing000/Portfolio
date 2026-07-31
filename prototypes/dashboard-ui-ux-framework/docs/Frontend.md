# Dashboard UI/UX Framework — Frontend Layer (Generic)

One Angular module, one dataset, no "dataset" abstraction — every view
reads the same underlying tables, just grouped/filtered differently. One
shared service and one models file serve every view; view-specific code is
only the filter fields and the load/render logic each screen actually
needs.

Naming below follows `../README.md` §4.

---

## 1. Routing

| Route | Component | Notes |
|---|---|---|
| Module root | Landing-page component | View picker cards. Sits **outside** the shell. |
| One child route per view | Each view's component | Inside the shell component |
| Import route (optional) | Import component | Either an in-module upload flow or a hand-off to a standalone tool — see `Backend.md` §5 |

The shell component renders a breadcrumb/nav-tabs bar and a router outlet
for whichever view is currently active.

---

## 2. Component inventory

| Component | Role |
|---|---|
| Landing page | View cards; the module's one-time filter-data prefetch is typically triggered from the app's own bootstrap sequence, not here (see §4.2) |
| Shell | Breadcrumb + nav-tabs wrapping every dashboard view |
| Overview view | Top-level KPI strip + breakdown cards, unfiltered (or minimally filtered) |
| `{Dimension}`-wise views (one per grouping) | Grouped rows, optionally `Category`-pivoted |
| `{Grain}` detail view | Flat row per finest-grain entity, full filter bar across every dimension |
| Source-data view | Full sortable/filterable raw row browser |
| Import view (optional) | Upload flow, or an embed/hand-off to a standalone tool |
| Pivot-table renderer (shared) | Renders the `Category`-pivoted grid for every grouped view — one implementation, not duplicated per view |
| Multi-select (shared) | Checkbox dropdown with search + Select All/None, virtual-scrolled for option lists that can run into the hundreds |
| Export button (shared) | Exports exactly what's on screen to a spreadsheet, not a fresh unfiltered query |
| Paginator (shared) | Client-side pager |
| Tier legend (shared, optional) | Legend/filter for any tiered ratio metric (e.g. good/watch/risk bands) |
| Horizontal-scroll helper (shared) | Restores a visible scrollbar for a split/frozen table |

---

## 3. Service layer

A single, app-root-scoped service. Every data call goes through one private
envelope-builder helper that assembles the fixed request shape (see
`Backend.md` §1), sends it, and decrypts the response.

| Method shape | Maps to `RequestType` | Notes |
|---|---|---|
| Filter-options loader (scoped, e.g. by one dimension) | `{Prefix}_LoadFilters` | Cached per scope-combination, in-memory, shared across views |
| One-time full-bundle prefetch | `{Prefix}_LoadFilters` (unscoped) | The **one** unscoped call the app makes per session — see §4 |
| Client-side faceted-options computer | — (no network call) | Computed from the prefetched raw dimension-combination payload |
| Selection-pruning helper | — (no network call) | Drops now-invalid selections after a facet narrows |
| One getter per view | `{Prefix}_Overview`, `{Prefix}_{Dimension}Wise`, `{Prefix}_{Grain}Detail`, `{Prefix}_SourceData`, … | Each takes that view's own filter set + the shared basis toggle (§5) |

An `extra`/override parameter on every call lets a caller override any
envelope field (useful for a view that deliberately needs "every scope", not
just the caller's own default scope).

---

## 4. Filter architecture

### 4.1 The data model

The filter-loader's raw "Mapping" payload returns **every** raw dimension-
combination tuple — not a deduplicated per-column list. This is what lets
every dropdown narrow every other dropdown client-side, with zero further
network calls once fetched.

### 4.2 Prefetch, once per session

| Trigger | Where | Behavior |
|---|---|---|
| App bootstrap (login **and** every refresh) | The host app's own startup sequence, alongside whatever other app-wide reference data it already loads | Fires the module's prefetch, unawaited, in parallel with the rest of bootstrap |
| First call in a session | The prefetch method | Checks a persistent, tab-scoped cache first; on a miss, fetches (with one automatic retry on failure), then writes the result back to that cache |
| Every later call, same session | Same method | Resolves instantly from cache — no network call |

This is a deliberate, one-time trade-off: the unscoped payload (every value
of every dimension) is large enough that decoding it can visibly stall the
UI for a moment — accepted **once** per session (persisted across refreshes
via a tab-scoped store) in exchange for every view afterward needing zero
further filter-loading calls.

### 4.3 Faceted (order-independent) cross-filtering

The faceted-options computer builds each dropdown's own option list by
filtering the raw mapping payload on **every other** currently-selected
facet — never on its own selection. This means:

- Picking a value in any one dimension narrows every other dimension.
- There's no fixed pick order enforced (e.g. "region before team") — the
  narrowing is symmetric in every direction, since the underlying mapping
  rows are flat tuples with no real tree structure.

Each view wires **every** facet dropdown it has to one shared
`refreshOptions()`-style method, which:

1. Recomputes every one of that view's facets' options from the current
   full selection.
2. Prunes each facet's own selection to drop any already-checked value no
   longer valid given what else is now picked.

Views with fewer dimensions simply pass a smaller selection object into the
same generic computation — nothing about the mechanism changes.

### 4.4 Multi-select commit timing

Checking a box updates the dropdown's own local state instantly (purely
local, no network). The **commit** to the parent (which triggers
`refreshOptions()`/a reload) is deliberately deferred until the dropdown
closes — picking several values one at a time shouldn't fire a separate
recomputation per click. The dropdown's "close on outside click" listener
should use a `mousedown`-class event, not `click` — otherwise a same-click
Search button next to it can read the pre-commit (stale) selection, since
element-level click handlers fire before a document-level click listener
for the same event.

---

## 5. Dual-basis metrics & bounded ratios

| Concept | Pattern |
|---|---|
| Basis toggle | A `Count`/`Amount`-style enum, present on every filterable view |
| Applied vs. selected basis | Two separate fields — the dropdown's current selection vs. what's actually rendered — decoupled so toggling the control alone doesn't re-label headers before the view reloads |
| Ratio metric for flat views | `numerator / denominator * 100`, both fields already basis-aware from the read procedure (see `Database.md` §4.3) |
| Ratio metric for pivoted views | Same formula, computed once per `Category` value + once for the total, inside the shared pivot-table renderer |
| Ratio tiers | A small number of bands (e.g. good/watch/risk) plus a legend component that doubles as a client-side filter |
| Export of computed/derived fields | Attach them as real row properties before export, formatted to match on-screen text exactly — a value that only exists as a template-computed getter silently drops out of a raw-row export |

---

## 6. Models

| Type | Shape | Used by |
|---|---|---|
| Filter option | `{ ID, Description }` | Every dropdown |
| Filter-options bundle | `Record<dimension name, FilterOption[]>` | The filter loader's per-column response |
| Raw mapping row | One property per dimension | Client-side faceted filtering |
| Facet-key union | The literal set of dimension names that are real dropdowns | The faceted-options computer |
| Basis enum | `'Count' | 'Amount'` | Every filterable view |
| Overview shape | KPI object + a list of breakdown rows | Overview view |
| Grouped-row shape | Loosely typed (left-side grouping columns vary per view); `{Category}_{Measure}` columns always present | Every `{Dimension}`-wise view |
| Detail-row shape | One property per dimension + measures | The finest-grain detail view |
| Source row shape | Matches the raw table's columns 1:1 | Source-data view |

---

## 7. Export

Client-side spreadsheet generation, using a library that actually supports
cell styling (borders/fonts/fills) — a bare "array of objects → sheet"
library is often not enough if visual parity with the on-screen table
matters. Exports exactly the rows/columns/labels a view's own state
currently holds — never a fresh, independent query — so what a user
downloads always matches what they were looking at.

---

## 8. Styling conventions

| Concept | Pattern |
|---|---|
| Split table (frozen + scrollable columns) | Two independent tables side by side, not one table with sticky columns — avoids z-index/offset-measurement juggling between a frozen column and a sticky header |
| Border weight hierarchy | One thicker weight for the outer boundary/header separator/grand-total separator; one uniform thinner weight for every other internal grid line |
| Frozen/scrollable divider | Built from two ordinary cell borders meeting (last column's own border + first column's own border on the other side), not a special-cased single line |
| Row-height parity between the two split tables | Pin an explicit `line-height` on every cell — browsers compute a default "normal" line-height slightly differently per font-weight, which silently drifts two independently-laid-out tables out of sync over many rows otherwise |
| Table width | Don't force a fixed width beyond what content needs; use a floor (e.g. "at least 100% of the available area") so a short table still fills the space without artificially stretching narrow numeric columns |

---

## 9. Operational notes worth carrying over

- Every view's load method should use a sequence-number guard, not just a
  loading flag — an older in-flight request (e.g. an unconditional initial
  fetch on view-enter) can resolve *after* a newer, deliberate reload and
  must never be allowed to overwrite the newer result.
- A genuinely-empty search result should use the same "no data" messaging
  convention the rest of the host app already uses, not a bespoke
  per-view message — reserve a view's own inline text for genuinely
  different empty states (e.g. "nothing searched yet" vs. "search ran, zero
  matches" vs. "a client-side filter narrowed an already-fetched result to
  zero").
