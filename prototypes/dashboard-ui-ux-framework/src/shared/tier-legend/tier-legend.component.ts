import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface Tier {
  tone: string;
  label: string;
  range: string;
}

// Legend for a tiered ratio-style metric's color bands (e.g. a
// good/watch/risk completion percentage) — keeps the tier thresholds
// visible on screen instead of only implied by cell color, and doubles as
// a filter: clicking a tier narrows whatever table/cards it sits above to
// just that tier. Clicking the same tier again clears the filter. The
// parent owns `selected` (two-way bound via [(selected)]) and is
// responsible for actually filtering its rows against it — this component
// only renders the legend and reports which tier is active.
@Component({
  selector: 'app-tier-legend',
  templateUrl: './tier-legend.component.html',
  styleUrls: ['./tier-legend.component.scss']
})
export class TierLegendComponent {
  // A short label for what's being tiered (e.g. "Completion %") — omit
  // for no caption.
  @Input() caption = '';

  // Caller supplies its own tiers/thresholds/labels — nothing here is
  // tied to a specific metric. `tone` is any string; styles/tokens' own
  // duf-tier-hi/mi/lo colors apply automatically for the conventional
  // 'hi'/'mi'/'lo' tones, or supply your own CSS for custom tone values.
  @Input() tiers: Tier[] = [
    { tone: 'hi', label: 'Good', range: '' },
    { tone: 'mi', label: 'Watch', range: '' },
    { tone: 'lo', label: 'Risk', range: '' },
  ];

  @Input() selected: string | null = null;
  @Output() selectedChange = new EventEmitter<string | null>();

  toggle(tone: string): void {
    this.selected = this.selected === tone ? null : tone;
    this.selectedChange.emit(this.selected);
  }
}
