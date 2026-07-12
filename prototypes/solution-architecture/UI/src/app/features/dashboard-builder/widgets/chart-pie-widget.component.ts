import {
  Component, Input, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, inject, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Chart, registerables } from 'chart.js';
import { SignalService } from '../../../core/services/signal.service';
import { WidgetConfig } from '../../../core/models/widget.model';

Chart.register(...registerables);

@Component({
  selector: 'app-chart-pie-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule],
  template: `
    <div class="chart-widget">
      <div *ngIf="loading()" class="cw-loading"><mat-spinner diameter="32"></mat-spinner></div>
      <div *ngIf="error()" class="cw-error"><mat-icon>error</mat-icon> {{ error() }}</div>
      <canvas #canvas [style.display]="loading() || error() ? 'none' : 'block'"></canvas>
    </div>
  `,
  styles: [`
    .chart-widget { height: 100%; position: relative; }
    canvas { width: 100% !important; height: 100% !important; }
    .cw-loading, .cw-error {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; height: 100%; color: rgba(0,0,0,.54);
    }
    .cw-error { color: #ef4444; }
  `]
})
export class ChartPieWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() config!: WidgetConfig;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly signalSvc = inject(SignalService);
  private chart?: Chart;
  private refreshTimer?: ReturnType<typeof setInterval>;
  private dataReady = false;
  private pendingData?: number[];

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);

  ngOnInit(): void {
    this.loadData();
    const interval = (this.config?.refreshInterval ?? 60) * 1000;
    this.refreshTimer = setInterval(() => this.loadData(), interval);
  }

  ngAfterViewInit(): void {
    this.initChart();
    if (this.pendingData) this.updateChart(this.pendingData);
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
    this.chart?.destroy();
  }

  private initChart(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;
    this.chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Critical', 'Error', 'Warning', 'Info'],
        datasets: [{
          data: [0, 0, 0, 0],
          backgroundColor: ['#ef4444', '#f59e0b', '#eab308', '#3b82f6']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private updateChart(counts: number[]): void {
    if (!this.chart) { this.pendingData = counts; return; }
    this.chart.data.datasets[0].data = counts;
    this.chart.update();
  }

  private loadData(): void {
    this.loading.set(true);
    this.signalSvc.getOpenSignals(500).subscribe({
      next: r => {
        const signals = r.data ?? [];
        const counts = [4, 3, 2, 1].map(sev => signals.filter(s => s.severity === sev).length);
        this.updateChart(counts);
        this.loading.set(false);
      },
      error: e => { this.error.set(e?.message ?? 'Load failed'); this.loading.set(false); }
    });
  }
}
