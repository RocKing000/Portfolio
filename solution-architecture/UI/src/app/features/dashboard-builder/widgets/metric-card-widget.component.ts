import {
  Component, Input, OnInit, OnDestroy, inject, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SignalService } from '../../../core/services/signal.service';
import { WidgetConfig } from '../../../core/models/widget.model';

@Component({
  selector: 'app-metric-card-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="metric-card" [style.border-top-color]="borderColor()">
      <div *ngIf="loading()" class="metric-loading">
        <mat-spinner diameter="32"></mat-spinner>
      </div>
      <ng-container *ngIf="!loading()">
        <mat-icon class="metric-icon" [style.color]="borderColor()">{{ icon() }}</mat-icon>
        <div class="metric-value" [style.color]="valueColor()">{{ count() }}</div>
        <div class="metric-label">{{ label() }}</div>
        <div *ngIf="error()" class="metric-error">{{ error() }}</div>
      </ng-container>
    </div>
  `,
  styles: [`
    .metric-card {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 12px;
      border-top: 4px solid #3b82f6;
      text-align: center;
    }
    .metric-icon { font-size: 36px; height: 36px; width: 36px; opacity: .7; }
    .metric-value { font-size: 48px; font-weight: 700; line-height: 1; margin: 4px 0; }
    .metric-label { font-size: 13px; color: rgba(0,0,0,.54); }
    .metric-loading { display: flex; justify-content: center; padding: 24px; }
    .metric-error { font-size: 11px; color: #ef4444; margin-top: 4px; }
  `]
})
export class MetricCardWidgetComponent implements OnInit, OnDestroy {
  @Input() config!: WidgetConfig;

  private readonly signalSvc = inject(SignalService);
  private refreshTimer?: ReturnType<typeof setInterval>;

  readonly count   = signal<number>(0);
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);

  icon  = () => this.config?.chartConfig?.colors?.[0] ?? 'error_outline';
  label = () => this.config?.title ?? 'Total Signals';

  borderColor = () => {
    const threshold = this.count();
    if (threshold > 100) return '#ef4444';
    if (threshold > 50)  return '#f59e0b';
    return '#3b82f6';
  };

  valueColor = () => {
    if (this.count() > 100) return '#ef4444';
    if (this.count() > 50)  return '#f59e0b';
    return 'inherit';
  };

  ngOnInit(): void {
    this.loadData();
    const interval = (this.config?.refreshInterval ?? 60) * 1000;
    this.refreshTimer = setInterval(() => this.loadData(), interval);
  }

  ngOnDestroy(): void { clearInterval(this.refreshTimer); }

  private loadData(): void {
    this.loading.set(true);
    const f = this.config?.filters;
    this.signalSvc.getOpenSignals(
      f?.limit ?? 500,
      f?.severity,
      f?.signalType
    ).subscribe({
      next:  r => { this.count.set(r.data?.length ?? 0); this.loading.set(false); },
      error: e => { this.error.set(e?.message ?? 'Load failed'); this.loading.set(false); }
    });
  }
}
