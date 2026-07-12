import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, inject, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GridStack, GridStackNode } from 'gridstack';
import { DashboardStore } from '../../../core/services/dashboard.store';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Widget } from '../../../core/models/dashboard.model';
import { WidgetPosition } from '../../../core/models/widget.model';
import { WidgetWrapperComponent } from '../widget-wrapper/widget-wrapper.component';
import { WidgetLibraryComponent } from '../widget-library/widget-library.component';
import { WidgetTemplate } from '../../../core/models/dashboard.model';

@Component({
  selector: 'app-dashboard-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule,
    WidgetWrapperComponent
  ],
  templateUrl: './dashboard-canvas.component.html',
  styleUrl: './dashboard-canvas.component.scss'
})
export class DashboardCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gridContainer') gridContainerRef!: ElementRef<HTMLElement>;

  private readonly route        = inject(ActivatedRoute);
  private readonly store        = inject(DashboardStore);
  private readonly dashboardSvc = inject(DashboardService);
  private readonly dialog       = inject(MatDialog);
  private readonly snackBar     = inject(MatSnackBar);

  private grid?: GridStack;
  private gridInitialized = false;

  readonly loading       = this.store.loading;
  readonly selectedLayout = this.store.selectedLayout;
  readonly layouts        = this.store.layouts;
  readonly layoutLoaded  = signal(false);

  get widgets(): Widget[] { return this.selectedLayout()?.widgets ?? []; }

  ngOnInit(): void {
    this.store.loadLayouts().then(async () => {
      const id = this.route.snapshot.paramMap.get('id')
               ?? this.store.defaultLayout()?.layoutId
               ?? this.store.layouts()[0]?.layoutId;

      if (id) {
        await this.store.loadLayoutDetails(id);
        this.layoutLoaded.set(true);
        // Allow Angular one tick to render the grid items, then init GridStack
        setTimeout(() => this.initGrid(), 0);
      } else {
        this.layoutLoaded.set(true);
      }
    });
  }

  ngAfterViewInit(): void { /* grid init happens after data is loaded */ }

  ngOnDestroy(): void {
    this.grid?.destroy(false);
  }

  private initGrid(): void {
    if (this.gridInitialized || !this.gridContainerRef) return;

    this.grid = GridStack.init({
      column:       12,
      cellHeight:   60,
      margin:       8,
      draggable:    { handle: '.widget-drag-handle' },
      resizable:    { handles: 'se' },
      float:        true,
      animate:      true
    }, this.gridContainerRef.nativeElement);

    this.grid.on('change', (_: Event, items: GridStackNode[]) => {
      for (const item of items) {
        const widgetId = (item.el as HTMLElement | undefined)?.dataset?.['widgetId'];
        if (widgetId && item.x != null) {
          const pos: WidgetPosition = { col: item.x, row: item.y ?? 0, width: item.w ?? 4, height: item.h ?? 3 };
          this.dashboardSvc.updateWidgetPosition(widgetId, JSON.stringify(pos)).subscribe();
        }
      }
    });

    this.gridInitialized = true;
  }

  openWidgetLibrary(): void {
    const layout = this.selectedLayout();
    if (!layout) { this.snackBar.open('No layout selected', 'OK', { duration: 3000 }); return; }

    const ref = this.dialog.open(WidgetLibraryComponent, {
      width: '760px',
      data: { layoutId: layout.layoutId }
    });

    ref.afterClosed().subscribe((template: WidgetTemplate | null) => {
      if (!template) return;
      this.addWidgetFromTemplate(layout.layoutId, template);
    });
  }

  private addWidgetFromTemplate(layoutId: string, template: WidgetTemplate): void {
    this.dashboardSvc.addWidget({
      layoutId,
      widgetType:   template.widgetType,
      title:        template.templateName,
      position:     template.defaultPosition ?? JSON.stringify({ col: 0, row: 0, width: 4, height: 4 }),
      config:       template.defaultConfig ?? '{}'
    }).subscribe({
      next: r => {
        if (r.success) {
          this.store.refreshCurrentLayout().then(() => {
            setTimeout(() => this.syncNewWidget(r.data), 50);
          });
        }
      },
      error: () => this.snackBar.open('Failed to add widget', 'Dismiss', { duration: 4000 })
    });
  }

  private syncNewWidget(widget: Widget): void {
    if (!this.grid) return;
    const pos = this.parsePosition(widget.position);
    const el  = this.gridContainerRef.nativeElement
      .querySelector(`[data-widget-id="${widget.widgetId}"]`) as HTMLElement | null;
    if (el) this.grid.makeWidget(el);
  }

  removeWidget(widgetId: string): void {
    const layout = this.selectedLayout();
    if (!layout) return;

    this.dashboardSvc.deleteWidget(widgetId).subscribe({
      next: () => {
        this.store.removeWidgetFromLayout(widgetId);
        const el = this.gridContainerRef.nativeElement
          .querySelector(`[data-widget-id="${widgetId}"]`) as HTMLElement | null;
        if (el && this.grid) this.grid.removeWidget(el, true);
      },
      error: () => this.snackBar.open('Failed to remove widget', 'Dismiss', { duration: 4000 })
    });
  }

  onWidgetUpdated(updated: Widget): void {
    this.store.updateWidgetInLayout(updated);
  }

  parsePosition(posJson?: string): WidgetPosition {
    try {
      const p = JSON.parse(posJson ?? '{}');
      return { col: p.col ?? 0, row: p.row ?? 0, width: p.width ?? 4, height: p.height ?? 4 };
    } catch { return { col: 0, row: 0, width: 4, height: 4 }; }
  }
}
