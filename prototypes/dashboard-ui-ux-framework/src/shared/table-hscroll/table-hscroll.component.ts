import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

// A slim, always-visible horizontal scrollbar rendered between a table and
// its paginator. .duf-table-container hides its own native scrollbar (see
// styles/tokens' -ms-overflow-style/::-webkit-scrollbar rules — done for a
// cleaner card look), which leaves a wide table scrollable only by
// trackpad/click-drag with no visible affordance. This mirrors that
// container's horizontal scroll two-way: dragging this bar scrolls the
// table, and scrolling the table (trackpad, shift+wheel, drag) moves this
// bar.
//
// Usage: `<app-table-hscroll [container]="tblWrap"></app-table-hscroll>`
// right after a `<div class="duf-table-container" #tblWrap>` — `container`
// takes the plain HTMLElement (via a template reference variable), not an
// ElementRef, since that's what a `#ref` template variable resolves to on
// a native element.
@Component({
  selector: 'app-table-hscroll',
  templateUrl: './table-hscroll.component.html',
  styleUrls: ['./table-hscroll.component.scss']
})
export class TableHscrollComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() container: HTMLElement | null = null;

  spacerWidth = 0;
  visible = false;
  // This component sits as a sibling right after .duf-table-split (which
  // holds .duf-table-fixed + .duf-table-container side by side), not
  // nested inside the scrollable half itself — with no explicit width of
  // its own, .duf-hscroll would default to the FULL row's width (fixed +
  // scrollable combined), wider than `container`'s own clientWidth by
  // exactly .duf-table-fixed's width. Since scrollLeft syncing is 1:1 (an
  // absolute pixel value, not a ratio), a bar wider than the container it's
  // meant to drive has a smaller max scrollLeft than the container
  // actually needs — dragging it all the way right would leave the
  // container permanently short of its own true end, cutting off the last
  // columns. barWidth/barMarginLeft below size and position this bar to
  // match `container` exactly, so both share the same scroll range.
  barWidth = 0;
  barMarginLeft = 0;

  private resizeObserver?: ResizeObserver;
  private syncing = false;
  private viewReady = false;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.attach();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['container'] && this.viewReady) {
      this.detach(changes['container'].previousValue);
      this.attach();
    }
  }

  ngOnDestroy(): void {
    this.detach(this.container);
  }

  private attach(): void {
    if (!this.container) return;
    this.container.addEventListener('scroll', this.onContainerScroll);
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(this.container);
    const table = this.container.querySelector('table');
    if (table) this.resizeObserver.observe(table);
    // Deferred a tick — calling measure() synchronously here (inside
    // ngAfterViewInit) mutates `visible`/`spacerWidth`, which this
    // component's own template binds to, AFTER Angular has already
    // checked those bindings for the current change-detection pass —
    // throwing NG0100 (ExpressionChangedAfterItHasBeenCheckedError) in
    // dev mode. The ResizeObserver's own automatic initial callback would
    // eventually set these too, but only after its own async delay; this
    // keeps the scrollbar's first paint from waiting on that while still
    // avoiding the same-tick mutation.
    setTimeout(() => this.measure());
  }

  private detach(container: HTMLElement | null | undefined): void {
    container?.removeEventListener('scroll', this.onContainerScroll);
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }

  private measure(): void {
    if (!this.container) return;
    this.spacerWidth = this.container.scrollWidth;
    this.visible = this.container.scrollWidth > this.container.clientWidth + 1;
    this.barWidth = this.container.clientWidth;

    const parent = this.el.nativeElement.parentElement;
    if (parent) {
      this.barMarginLeft = this.container.getBoundingClientRect().left - parent.getBoundingClientRect().left;
    }
  }

  private onContainerScroll = (): void => {
    if (this.syncing || !this.container) return;
    this.syncing = true;
    this.el.nativeElement.firstElementChild!.scrollLeft = this.container.scrollLeft;
    this.syncing = false;
  };

  onBarScroll(bar: HTMLElement): void {
    if (this.syncing || !this.container) return;
    this.syncing = true;
    this.container.scrollLeft = bar.scrollLeft;
    this.syncing = false;
  }
}
