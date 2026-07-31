import { Component, Input, OnChanges } from '@angular/core';
import { PivotRow } from '../../models';

// Shared renderer for any "N group-by columns on the left, M metrics
// repeated once per category value plus a Total" grid. Grouped/pivoted
// dashboard views typically differ only in which columns sit to the left
// of the pivoted columns and which category/metric set they pivot on —
// the grid structure itself (fixed left columns | scrollable pivoted
// columns, grand-total row, category-group separators) is identical.
// Extracted here instead of duplicated once per view.
//
// Row shape expected: for each category value `c` and each metric key
// `m`, a `${c}_${m}` property; a `Total_${m}` property for the combined
// total; and, if a ratio metric is configured, `${c}_${ratioNumeratorKey}`/
// `${c}_${ratioDenominatorKey}` (+ `Total_...`) shadow properties.
@Component({
  selector: 'app-pivot-table',
  templateUrl: './pivot-table.component.html',
  styleUrls: ['./pivot-table.component.scss']
})
export class PivotTableComponent implements OnChanges {

  // Header labels for the left (non-pivoted) columns, e.g. ['Region','Team'].
  @Input() leftLabels: string[] = [];
  // Row property keys matching leftLabels 1:1.
  @Input() leftKeys: string[] = [];

  // leftLabels/leftKeys always start with the columns meant to stay
  // visible while the pivoted columns scroll — split out here so the
  // template can render the first `fixedColumnCount` of them in their own
  // non-scrolling table (see .duf-table-split in styles/tokens) while
  // everything else renders in the scrollable one. Must be contiguous from
  // the start of leftKeys, since this is a plain slice.
  @Input() fixedColumnCount = 2;

  get fixedLabels(): string[] { return this.leftLabels.slice(0, this.fixedColumnCount); }
  get fixedKeys(): string[] { return this.leftKeys.slice(0, this.fixedColumnCount); }
  get restLabels(): string[] { return this.leftLabels.slice(this.fixedColumnCount); }
  get restKeys(): string[] { return this.leftKeys.slice(this.fixedColumnCount); }

  @Input() rows: PivotRow[] = [];

  // The category values being pivoted into columns (e.g. lifecycle
  // stages, regions, time buckets — whatever dimension is being pivoted
  // for this view), plus an implicit "Total" column always shown.
  @Input() categories: string[] = [];
  // Optional display-narrowing (a "which category column(s)" selector some
  // hosts offer) — when given a non-empty subset, only those category
  // columns render (plus Total, always). Empty/omitted = show all.
  @Input() visibleCategories: string[] = [];

  // Base metric field-name suffixes, in display order — each becomes a
  // column named `${category}_${metricKey}` per category, and
  // `Total_${metricKey}` for the total. E.g. ['Value1', 'Value2', 'Value3'].
  @Input() metricKeys: string[] = [];
  // Display labels matching metricKeys 1:1.
  @Input() metricLabels: string[] = [];

  // Field-name suffixes for a bounded ratio metric's numerator/denominator
  // shadow columns (see ../../../docs/Database.md §4.3) — e.g.
  // `${category}_${ratioNumeratorKey}` / `${category}_${ratioDenominatorKey}`.
  // Leave `ratioNumeratorKey` empty to omit the ratio column entirely.
  @Input() ratioNumeratorKey = '';
  @Input() ratioDenominatorKey = '';
  @Input() ratioLabel = 'Ratio %';

  // Tier thresholds for coloring the ratio cell, checked in array order —
  // first match wins. Default: >=90 good, >=80 watch, else risk.
  @Input() tierThresholds: { tone: string; min: number }[] = [
    { tone: 'hi', min: 90 }, { tone: 'mi', min: 80 }, { tone: 'lo', min: -Infinity },
  ];

  // Caller-supplied number formatter — defaults to a locale-formatted
  // number with an em-dash for zero/negative. Override for currency or
  // compact-unit formatting (e.g. "15.22M", "$1.2K").
  @Input() formatValue: (v: number) => string = (v) => (v <= 0 ? '—' : v.toLocaleString());

  get subMetrics(): string[] {
    return this.ratioNumeratorKey ? [...this.metricLabels, this.ratioLabel] : this.metricLabels;
  }

  get displayCategories(): string[] {
    return this.visibleCategories.length ? this.visibleCategories : this.categories;
  }

  // Client-side pager, rendered by shared/paginator. GRAND TOTAL is always
  // computed from the FULL rows array (cached here, not recomputed per
  // page) and stays pinned as the last row on every page, not just the
  // last one.
  page = 1;
  pageSize = 10;
  private cachedGrandTotal: PivotRow | null = null;

  get displayRows(): PivotRow[] {
    if (!this.rows.length) return [];
    const p = this.page - 1;
    const pageRows = this.rows.slice(p * this.pageSize, (p + 1) * this.pageSize);
    return [...pageRows, this.cachedGrandTotal!];
  }

  ngOnChanges(): void {
    this.cachedGrandTotal = this.rows.length ? this.computeGrandTotal() : null;
    this.page = 1;
  }

  // Client-computed GRAND TOTAL row — accumulated in JS rather than
  // requiring the server to compute a rollup. Only the first left column
  // gets the "GRAND TOTAL" label; the rest are blanked.
  private computeGrandTotal(): PivotRow {
    const total: PivotRow = { __total: true };
    this.leftKeys.forEach((k, i) => total[k] = i === 0 ? 'GRAND TOTAL' : '');
    const prefixes = [...this.categories.map(c => `${c}_`), 'Total_'];
    const sumKeys = this.ratioNumeratorKey
      ? [...this.metricKeys, this.ratioNumeratorKey, this.ratioDenominatorKey]
      : this.metricKeys;
    prefixes.forEach(prefix => {
      sumKeys.forEach(m => {
        total[prefix + m] = this.rows.reduce((s, r) => s + (Number(r[prefix + m]) || 0), 0);
      });
    });
    return total;
  }

  metric(row: PivotRow, prefix: string, key: string): number {
    return Number(row[prefix + key]) || 0;
  }

  private ratio(row: PivotRow, prefix: string): number {
    if (!this.ratioNumeratorKey) return 0;
    const d = this.metric(row, prefix, this.ratioDenominatorKey);
    const n = this.metric(row, prefix, this.ratioNumeratorKey);
    return d > 0 ? +(n / d * 100).toFixed(2) : 0;
  }

  fmtN(v: number): string {
    return this.formatValue(v);
  }

  fmtRatio(row: PivotRow, prefix: string): string {
    const d = this.metric(row, prefix, this.ratioDenominatorKey);
    return d > 0 ? this.ratio(row, prefix).toFixed(2) + '%' : '—';
  }

  // Tier tone for the ratio cell at this category, e.g. to color-code a
  // completion percentage. Matches tierThresholds in order.
  ratioTone(row: PivotRow, prefix: string): string {
    const p = this.ratio(row, prefix);
    const match = this.tierThresholds.find(t => p >= t.min);
    return match ? match.tone : (this.tierThresholds[this.tierThresholds.length - 1]?.tone ?? '');
  }
}
