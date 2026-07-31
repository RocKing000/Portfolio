# `src/` — Reusable Code

This is the actual, generic, drop-in-ready code half of the framework
(`../docs/Frontend.md` §2/§8 describe it in prose; this is the implementation).
Everything here is dataset-agnostic — no file references any specific
business domain, field name, or dataset.

```
src/
├── models.ts                         -- FilterOption, PivotRow
├── styles/
│   ├── _tokens.scss                  -- design tokens + base table/filter/button/paginator/legend styles
│   └── _table-veil.scss              -- optional backdrop + split-table row-height-parity mixin
└── shared/
    ├── multi-select/                 -- checkbox dropdown, virtual-scrolled, cross-narrowing-friendly
    ├── pivot-table/                  -- "N group columns + M metrics × category + Total" grid renderer
    ├── export-button/                -- exports exactly what's on screen to a bordered .xlsx (ExcelJS)
    ├── paginator/                    -- client-side pager
    ├── tier-legend/                  -- legend/filter for any tiered ratio metric
    └── table-hscroll/                -- visible, draggable horizontal scrollbar for a split/frozen table
```

This is deliberately **only** the `shared/` component library + the
styling layer + the two generic model types. It does **not** include a
`home/`/`shell/`/`views/`/`import/` skeleton, `*.module.ts`,
`*-routes.ts`, or a service — those are dataset-specific by nature (a
view's own filter fields, a service's own per-view methods, a landing
page's own card list) and belong in the **consuming** module, built
following the pattern in `../docs/Frontend.md` and the checklist in
`../README.md` §6, not duplicated here as dead scaffolding.

---

## Wiring this into a new module

1. Copy `styles/` and `shared/` into your module's own directory (or
   reference them directly if your build supports a shared library path).
2. Copy `models.ts`, or merge `FilterOption`/`PivotRow` into your own
   models file — every shared component imports from `../../models`
   relative to its own folder, so keep that relative path valid wherever
   you place it.
3. In your `*.module.ts`, declare the 6 components from `shared/` and
   import `ScrollingModule` (`@angular/cdk/scrolling`, required by
   `multi-select`'s virtual scroll) alongside your usual `CommonModule`/
   `FormsModule`/`MaterialModule`.
4. In each view's own SCSS, `@import '<path-to>/styles/tokens';` (and
   `@import '<path-to>/styles/table-veil'; @include duf-table-veil(...);`
   wherever you want the backdrop/row-height-parity treatment — pass your
   own image URL, or call it with no argument for a plain table).
5. Use the components as documented in each one's own header comment:
   - `<app-multi-select [options]="..." [(selected)]="..." (selectedChange)="...">`
   - `<app-pivot-table [leftLabels]="..." [leftKeys]="..." [rows]="..." [categories]="..." [metricKeys]="..." [metricLabels]="..." [ratioNumeratorKey]="..." [ratioDenominatorKey]="...">`
   - `<app-export-button [rows]="..." [columns]="..." [columnLabels]="...">`
   - `<app-paginator [(page)]="..." [(pageSize)]="..." [totalItems]="...">`
   - `<app-tier-legend [(selected)]="..." [tiers]="..." [caption]="...">`
   - `<app-table-hscroll [container]="tblWrap">` right after a
     `<div class="duf-table-container" #tblWrap>`

None of the 6 components depend on each other except `pivot-table`, which
expects `table-hscroll` and `paginator` to also be declared in the same
module (it uses both in its own template).

**Peer dependencies**: `@angular/cdk` (`ScrollingModule`, used by
`multi-select`) and `exceljs` (used by `export-button`) — neither ships
with plain Angular, so a consuming project needs both installed.
