import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FilterOption } from '../../models';

// Checkbox dropdown with search + Select All/None. Use wherever a filter
// needs "pick several", not just "pick one". Virtual-scrolled internally
// (see the template) so long option lists don't freeze the page on open.
@Component({
  selector: 'app-multi-select',
  templateUrl: './multi-select.component.html',
  styleUrls: ['./multi-select.component.scss']
})
export class MultiSelectComponent {
  @Input() options: FilterOption[] = [];
  @Input() selected: string[] = [];
  @Output() selectedChange = new EventEmitter<string[]>();
  @Input() placeholder = 'All';

  open = false;
  search = '';

  constructor(private host: ElementRef<HTMLElement>) {}

  get filteredOptions(): FilterOption[] {
    const q = this.search.trim().toLowerCase();
    return q ? this.options.filter(o => o.Description.toLowerCase().includes(q)) : this.options;
  }

  get triggerLabel(): string {
    if (!this.selected.length) return this.placeholder;
    // Checked before the "All (N)" case below — otherwise, whenever the
    // OPTIONS list itself has been narrowed down to exactly one entry
    // (e.g. by another filter's cross-narrowing) and that one entry is
    // picked, `selected.length === options.length` (1 === 1) would match
    // first and show "All (1)" instead of the actual selected name.
    if (this.selected.length === 1) {
      const opt = this.options.find(o => o.ID === this.selected[0]);
      if (opt) return opt.Description;
    }
    if (this.options.length && this.selected.length === this.options.length) return `All (${this.options.length})`;
    return `${this.selected.length} selected`;
  }

  // selectedChange only fires when the dropdown CLOSES, not per checkbox —
  // a caller that cascades other filters on every change would otherwise
  // re-fetch on every single click, so picking 5 values one at a time
  // would fire 5 sequential reloads. The checkboxes themselves still
  // update `this.selected`/re-render instantly on every click (purely
  // local state) — only the (potentially expensive) notification to the
  // parent is deferred to "done picking".
  toggle(): void {
    const wasOpen = this.open;
    this.open = !this.open;
    if (this.open) this.search = '';
    else if (wasOpen) this.selectedChange.emit(this.selected);
  }

  isChecked(id: string): boolean {
    return this.selected.includes(id);
  }

  // Some option lists can run into the hundreds — rendered via
  // cdk-virtual-scroll-viewport in the template so only the rows actually
  // on screen ever exist as DOM nodes, regardless of list size; a plain
  // *ngFor over a long list is what makes opening a dropdown like this
  // visibly freeze the page. trackBy keyed on ID (stable across
  // re-renders) so the virtual viewport can reuse row elements instead of
  // recreating them during scroll/search.
  trackByOption(_index: number, o: FilterOption): string {
    return o.ID;
  }

  onCheck(id: string, checked: boolean): void {
    this.selected = checked ? [...this.selected, id] : this.selected.filter(x => x !== id);
  }

  selectAll(): void {
    this.selected = this.options.map(o => o.ID);
  }

  selectNone(): void {
    this.selected = [];
  }

  // Closes the dropdown on outside click, and is where the deferred
  // selectedChange fires for that close path (see toggle()).
  //
  // Listens on `mousedown`, not `click` — checking a box then immediately
  // clicking a Search button right next to this dropdown (without first
  // clicking elsewhere to close it) fires ONE click on that button, which
  // bubbles from the button up to `document`. A `document:click` listener
  // here would fire AFTER the Search button's own click handler (element-
  // level listeners run before ancestor/document-level ones for the same
  // bubbling event), so a caller's own load() would read the OLD
  // selection — this component's "commit the selection" emit hadn't
  // happened yet — and fire a request with stale filters. `mousedown`
  // fires (and finishes) before `click` in the DOM's own event order, so
  // the selection is already committed by the time any sibling click
  // handler runs.
  @HostListener('document:mousedown', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (this.open && !this.host.nativeElement.contains(e.target as Node)) {
      this.open = false;
      this.selectedChange.emit(this.selected);
    }
  }
}
