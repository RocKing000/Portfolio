// Generic response/option shapes shared by every component in this
// framework. Nothing here is tied to any specific dataset — a consuming
// module reuses these as-is and adds its own view-specific types alongside
// them (see ../docs/Frontend.md §6 for the full pattern).

export interface FilterOption {
  ID: string;
  Description: string;
}

// A pivoted grid row: fixed "group" columns plus, per category value, a
// set of metric columns named `${category}_${metricKey}` — see
// shared/pivot-table. Loosely typed on purpose; the exact columns vary per
// dataset/view.
export type PivotRow = Record<string, any>;
