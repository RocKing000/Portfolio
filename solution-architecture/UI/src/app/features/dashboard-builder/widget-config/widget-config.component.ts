import {
  Component, inject, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Widget } from '../../../core/models/dashboard.model';
import { WidgetConfig } from '../../../core/models/widget.model';

export interface WidgetConfigDialogData { widget: Widget }

@Component({
  selector: 'app-widget-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatSlideToggleModule, MatProgressSpinnerModule
  ],
  templateUrl: './widget-config.component.html'
})
export class WidgetConfigComponent {
  private readonly fb           = inject(FormBuilder);
  private readonly dashboardSvc = inject(DashboardService);
  private readonly dialogRef    = inject(MatDialogRef<WidgetConfigComponent>);
  private readonly snackBar     = inject(MatSnackBar);
  readonly data = inject<WidgetConfigDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);

  private get parsedConfig(): Partial<WidgetConfig> {
    try { return JSON.parse(this.data.widget.config ?? '{}'); } catch { return {}; }
  }

  readonly form = this.fb.nonNullable.group({
    title:           [this.data.widget.title ?? this.parsedConfig.title ?? ''],
    dataSource:      [this.parsedConfig.dataSource ?? 'signals'],
    refreshInterval: [this.parsedConfig.refreshInterval ?? 60],
    signalType:      [this.parsedConfig.filters?.signalType ?? ''],
    severity:        [this.parsedConfig.filters?.severity ?? null as number | null],
    limit:           [this.parsedConfig.filters?.limit ?? 50],
    periodType:      [this.parsedConfig.filters?.periodType ?? 'DAY'],
    rawConfig:       [this.data.widget.config ?? '{}', this.jsonValidator]
  });

  readonly dataSources = ['signals', 'aggregations', 'assigned'];
  readonly periodTypes  = ['HOUR', 'DAY', 'WEEK', 'MONTH'];
  readonly severities   = [
    { value: 1, label: 'Info (1+)' },
    { value: 2, label: 'Warning (2+)' },
    { value: 3, label: 'Error (3+)' },
    { value: 4, label: 'Critical (4)' }
  ];

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);

    const v = this.form.getRawValue();
    const config: WidgetConfig = {
      title:           v.title,
      dataSource:      v.dataSource,
      refreshInterval: v.refreshInterval,
      filters: {
        signalType: v.signalType || undefined,
        severity:   v.severity   ?? undefined,
        limit:      v.limit,
        periodType: v.periodType
      }
    };

    this.dashboardSvc.updateWidgetConfig(this.data.widget.widgetId, {
      title:  v.title || undefined,
      config: JSON.stringify(config)
    }).subscribe({
      next:  result => { this.saving.set(false); this.dialogRef.close(result.data); },
      error: err    => {
        this.saving.set(false);
        this.snackBar.open(err?.message ?? 'Failed to update widget', 'Dismiss', { duration: 4000 });
      }
    });
  }

  cancel(): void { this.dialogRef.close(null); }

  private jsonValidator(ctrl: { value: string }) {
    if (!ctrl.value) return null;
    try { JSON.parse(ctrl.value); return null; }
    catch { return { invalidJson: true }; }
  }
}
