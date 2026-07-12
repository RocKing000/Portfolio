import { Injectable, inject, signal, computed } from '@angular/core';
import { Layout, LayoutDetails, Widget, WidgetTemplate } from '../models/dashboard.model';
import { DashboardService } from './dashboard.service';

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly dashboardService = inject(DashboardService);

  // State
  private readonly _layouts        = signal<Layout[]>([]);
  private readonly _selectedLayout = signal<LayoutDetails | null>(null);
  private readonly _templates      = signal<WidgetTemplate[]>([]);
  private readonly _loading        = signal(false);
  private readonly _error          = signal<string | null>(null);

  // Public read-only
  readonly layouts        = this._layouts.asReadonly();
  readonly selectedLayout = this._selectedLayout.asReadonly();
  readonly templates      = this._templates.asReadonly();
  readonly loading        = this._loading.asReadonly();
  readonly error          = this._error.asReadonly();

  readonly defaultLayout = computed(() =>
    this._layouts().find(l => l.isDefault) ?? null
  );

  readonly ownedLayouts = computed(() =>
    this._layouts().filter(l => l.isOwner)
  );

  readonly sharedLayouts = computed(() =>
    this._layouts().filter(l => !l.isOwner)
  );

  // Actions
  async loadLayouts(includeShared = true): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const resp = await this.dashboardService.getLayouts(includeShared).toPromise();
      if (resp?.success) this._layouts.set(resp.data);
    } catch (err: any) {
      this._error.set(err?.message ?? 'Failed to load layouts');
    } finally {
      this._loading.set(false);
    }
  }

  async loadLayoutDetails(id: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const resp = await this.dashboardService.getLayoutDetails(id).toPromise();
      if (resp?.success) this._selectedLayout.set(resp.data);
    } catch (err: any) {
      this._error.set(err?.message ?? 'Failed to load layout details');
    } finally {
      this._loading.set(false);
    }
  }

  async loadTemplates(category?: string): Promise<void> {
    try {
      const resp = await this.dashboardService.getWidgetTemplates(category).toPromise();
      if (resp?.success) this._templates.set(resp.data);
    } catch { /* non-critical */ }
  }

  updateWidgetInLayout(widget: Widget): void {
    const layout = this._selectedLayout();
    if (!layout) return;
    this._selectedLayout.set({
      ...layout,
      widgets: layout.widgets.map(w => w.widgetId === widget.widgetId ? widget : w)
    });
  }

  removeWidgetFromLayout(widgetId: string): void {
    const layout = this._selectedLayout();
    if (!layout) return;
    this._selectedLayout.set({
      ...layout,
      widgets: layout.widgets.filter(w => w.widgetId !== widgetId)
    });
  }

  clearSelectedLayout(): void { this._selectedLayout.set(null); }

  async refreshCurrentLayout(): Promise<void> {
    const current = this._selectedLayout();
    if (current) await this.loadLayoutDetails(current.layoutId);
  }
}
