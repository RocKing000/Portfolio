import {
  Component, OnInit, Inject, inject, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DashboardService } from '../../../core/services/dashboard.service';
import { WidgetTemplate } from '../../../core/models/dashboard.model';

export interface WidgetLibraryDialogData { layoutId: string }

@Component({
  selector: 'app-widget-library',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatDialogModule, MatCardModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatProgressSpinnerModule
  ],
  templateUrl: './widget-library.component.html'
})
export class WidgetLibraryComponent implements OnInit {
  private readonly dashboardSvc = inject(DashboardService);
  private readonly dialogRef    = inject(MatDialogRef<WidgetLibraryComponent>);
  readonly data = inject<WidgetLibraryDialogData>(MAT_DIALOG_DATA);

  readonly templates       = signal<WidgetTemplate[]>([]);
  readonly loading         = signal(false);
  readonly selectedCategory = signal<string | null>(null);

  readonly categories = ['ALL', 'ANALYTICS', 'SIGNALS', 'METRICS', 'CUSTOM'];

  get filteredTemplates(): WidgetTemplate[] {
    const cat = this.selectedCategory();
    if (!cat || cat === 'ALL') return this.templates();
    return this.templates().filter(t => t.category === cat);
  }

  ngOnInit(): void {
    this.loading.set(true);
    this.dashboardSvc.getWidgetTemplates().subscribe({
      next:  r => { this.templates.set(r.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  select(template: WidgetTemplate): void {
    this.dialogRef.close(template);
  }

  cancel(): void { this.dialogRef.close(null); }

  widgetIcon(widgetType: string): string {
    const map: Record<string, string> = {
      CHART_LINE:   'show_chart',
      CHART_BAR:    'bar_chart',
      CHART_PIE:    'pie_chart',
      TABLE:        'table_chart',
      METRIC:       'speed',
      METRIC_CARD:  'speed'
    };
    return map[widgetType] ?? 'widgets';
  }
}
