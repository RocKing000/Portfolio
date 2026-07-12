import {
  Component, Input, Output, EventEmitter, inject, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Widget } from '../../../core/models/dashboard.model';
import { WidgetConfig } from '../../../core/models/widget.model';
import { ChartLineWidgetComponent } from '../widgets/chart-line-widget.component';
import { ChartBarWidgetComponent } from '../widgets/chart-bar-widget.component';
import { ChartPieWidgetComponent } from '../widgets/chart-pie-widget.component';
import { TableWidgetComponent } from '../widgets/table-widget.component';
import { MetricCardWidgetComponent } from '../widgets/metric-card-widget.component';
import { WidgetConfigComponent } from '../widget-config/widget-config.component';

@Component({
  selector: 'app-widget-wrapper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MatIconModule, MatButtonModule, MatTooltipModule,
    ChartLineWidgetComponent, ChartBarWidgetComponent, ChartPieWidgetComponent,
    TableWidgetComponent, MetricCardWidgetComponent
  ],
  templateUrl: './widget-wrapper.component.html',
  styleUrl: './widget-wrapper.component.scss'
})
export class WidgetWrapperComponent {
  @Input() widget!: Widget;
  @Output() removeWidget = new EventEmitter<string>();
  @Output() widgetUpdated = new EventEmitter<Widget>();

  private readonly dialog   = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  get parsedConfig(): WidgetConfig {
    try { return JSON.parse(this.widget.config ?? '{}'); }
    catch { return { title: '', dataSource: 'signals' }; }
  }

  get title(): string {
    return this.widget.title ?? this.parsedConfig.title ?? this.widget.widgetType;
  }

  openConfig(): void {
    const ref = this.dialog.open(WidgetConfigComponent, {
      width: '520px',
      data: { widget: this.widget }
    });
    ref.afterClosed().subscribe(updated => {
      if (updated) this.widgetUpdated.emit(updated);
    });
  }

  remove(): void { this.removeWidget.emit(this.widget.widgetId); }
}
