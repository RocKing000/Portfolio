import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { catchError, EMPTY, forkJoin } from 'rxjs';
import Chart from 'chart.js/auto';
import { AnalyticsService } from '../../core/services/analytics.service';
import { TenantService } from '../../core/services/tenant.service';
import { TrendingError, DashboardMetrics } from '../../core/models/analytics.model';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DecimalPipe,
    DatePipe,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule
  ],
  templateUrl: './analytics-dashboard.component.html',
  styleUrl: './analytics-dashboard.component.scss'
})
export class AnalyticsDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly analyticsSvc = inject(AnalyticsService);
  private readonly tenantSvc = inject(TenantService);

  @ViewChild('trendChart') chartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild(MatSort) sort!: MatSort;

  private chart: Chart | null = null;

  readonly loading = signal(false);
  readonly trending = signal<TrendingError[]>([]);
  readonly metrics = signal<DashboardMetrics[]>([]);

  readonly periodCtrl = new FormControl('WEEK');
  readonly topNCtrl = new FormControl(10);
  readonly fromDateCtrl = new FormControl<Date | null>(null);
  readonly toDateCtrl = new FormControl<Date | null>(null);

  readonly tableSource = new MatTableDataSource<TrendingError>();
  readonly displayedColumns = ['errorCode', 'errorName', 'totalSearches', 'totalViews', 'helpfulnessPercentage'];

  get totalSearches(): number {
    return this.metrics().reduce((s, m) => s + m.totalSearches, 0);
  }

  get totalErrors(): number {
    return this.metrics().reduce((s, m) => s + m.totalErrorsIdentified, 0);
  }

  get avgDuration(): number {
    const valid = this.metrics().filter(m => m.avgSearchDurationMs != null);
    if (!valid.length) return 0;
    return valid.reduce((s, m) => s + (m.avgSearchDurationMs ?? 0), 0) / valid.length;
  }

  get topError(): string {
    return this.metrics()[0]?.topErrorCode ?? '—';
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.tableSource.sort = this.sort;
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  loadData(): void {
    this.loading.set(true);
    const tenant = this.tenantSvc.getTenant();
    const period = this.periodCtrl.value ?? 'WEEK';
    const topN = this.topNCtrl.value ?? 10;

    forkJoin({
      trending: this.analyticsSvc.getTrendingErrors(tenant, period, topN).pipe(catchError(() => EMPTY)),
      metrics: this.analyticsSvc.getDashboardMetrics(
        tenant,
        this.fromDateCtrl.value,
        this.toDateCtrl.value
      ).pipe(catchError(() => EMPTY))
    }).subscribe(({ trending, metrics }) => {
      this.loading.set(false);
      if (trending) {
        this.trending.set(trending as TrendingError[]);
        this.tableSource.data = trending as TrendingError[];
        this.renderChart(trending as TrendingError[]);
      }
      if (metrics) {
        this.metrics.set(metrics as DashboardMetrics[]);
      }
    });
  }

  private renderChart(data: TrendingError[]): void {
    if (!this.chartRef?.nativeElement) return;
    this.chart?.destroy();

    const top8 = data.slice(0, 8);
    this.chart = new Chart(this.chartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: top8.map(e => e.errorCode),
        datasets: [
          {
            label: 'Searches',
            data: top8.map(e => e.totalSearches),
            backgroundColor: 'rgba(0, 48, 135, 0.75)',
            borderRadius: 4
          },
          {
            label: 'Views',
            data: top8.map(e => e.totalViews),
            backgroundColor: 'rgba(255, 215, 0, 0.75)',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: false }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}
