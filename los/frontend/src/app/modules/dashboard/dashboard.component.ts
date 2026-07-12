import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Chart, ChartConfiguration } from 'chart.js';
import { ApiService } from '../../services/api.service';
import { DataService } from '../../services/data.service';
import { ChartService } from '../../services/chart.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="p-4 space-y-4 animate-fade-in">

      <!-- Page header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-800">Portfolio Overview</h1>
          <p class="text-sm text-gray-500">Loan Threat System — JLG Microfinance Dashboard</p>
        </div>
        <div class="flex gap-2">
          <select class="input-base w-36" [(ngModel)]="selectedMonth" (change)="onMonthChange()">
            <option value="">All Months</option>
            <option *ngFor="let m of data.months" [value]="m.label">{{m.display}}</option>
          </select>
          <button class="btn-secondary" (click)="reload()">↻ Refresh</button>
        </div>
      </div>

      <!-- Trends + Bucket Distribution -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Trend Chart (2/3 width) -->
        <div class="card lg:col-span-2">
          <p class="section-title">Demand vs Collection Trend</p>
          <div class="chart-wrapper" style="height:240px">
            <canvas #trendChart></canvas>
          </div>
        </div>
        <!-- Bucket Donut -->
        <div class="card">
          <p class="section-title">Bucket Distribution</p>
          <div class="chart-wrapper" style="height:200px">
            <canvas #bucketChart></canvas>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-1">
            <div *ngFor="let b of bucketEntries()" class="flex items-center gap-1">
              <div class="w-2 h-2 rounded-full" [style.background]="data.bucketColor(b[0])"></div>
              <span class="text-xs text-gray-600">{{b[0]}}: {{b[1]}}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Critical Loans -->
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <p class="section-title mb-0">Top 10 Critical Loans</p>
          <a routerLink="/alert-pools" class="text-xs text-blue-600 hover:underline">View All →</a>
        </div>
        <div *ngIf="loading" class="space-y-2">
          <div *ngFor="let i of [1,2,3,4,5]" class="skeleton h-8 w-full"></div>
        </div>
        <div *ngIf="!loading" class="overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Loan ID</th><th>Branch</th><th>DPD</th>
                <th>Outstanding</th><th>Bucket</th><th>Alert</th><th>Coll %</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let l of topCritical">
                <td class="font-mono text-xs">{{l.loan_id}}</td>
                <td>{{l.branch}}</td>
                <td class="font-bold" [style.color]="dpdColor(l.dpd)">{{l.dpd}}</td>
                <td>{{data.formatCurrency(l.outstanding)}}</td>
                <td>
                  <span class="badge" [class]="bucketBadge(l.bucket)">{{l.bucket}}</span>
                </td>
                <td>
                  <span class="badge" [class]="alertBadge(l.alert_level)">{{l.alert_level}}</span>
                </td>
                <td [style.color]="collColor(l.collection_eff)">{{l.collection_eff?.toFixed(1)}}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Monthly stats bar chart -->
      <div class="card">
        <p class="section-title">Month-over-Month NPA Count</p>
        <div class="chart-wrapper" style="height:200px">
          <canvas #npaChart></canvas>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('trendChart') trendChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('bucketChart') bucketChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('npaChart') npaChartRef!: ElementRef<HTMLCanvasElement>;

  selectedMonth = '';
  loading       = true;
  topCritical: any[] = [];
  trends: any[]      = [];
  buckets: any       = {};
  charts: Chart[]    = [];

  constructor(
    public data: DataService,
    private api: ApiService,
    private chartSvc: ChartService,
  ) {}

  ngOnInit() { this.reload(); }

  ngAfterViewInit() { this.initCharts(); }

  reload() {
    this.loading = true;
    this.api.topCritical(10).subscribe(d => {
      this.topCritical = d ?? [];
      this.loading = false;
    });
    this.api.trends().subscribe(d => {
      this.trends = d ?? [];
      this.drawTrendChart();
      this.drawNpaChart();
    });
    this.api.buckets(this.selectedMonth || undefined).subscribe(d => {
      this.buckets = d ?? {};
      this.drawBucketChart();
    });
  }

  onMonthChange() { this.reload(); }

  initCharts() {
    this.drawTrendChart();
    this.drawBucketChart();
    this.drawNpaChart();
  }

  private destroyChart(canvas: ElementRef<HTMLCanvasElement>) {
    const existing = Chart.getChart(canvas.nativeElement);
    if (existing) existing.destroy();
  }

  drawTrendChart() {
    if (!this.trendChartRef || !this.trends.length) return;
    this.destroyChart(this.trendChartRef);
    const cfg = this.chartSvc.trendLine(
      this.trends.map(t => t.month),
      this.trends.map(t => t.demand),
      this.trends.map(t => t.collected),
    );
    new Chart(this.trendChartRef.nativeElement, cfg);
  }

  drawBucketChart() {
    if (!this.bucketChartRef || !Object.keys(this.buckets).length) return;
    this.destroyChart(this.bucketChartRef);
    const labels = Object.keys(this.buckets);
    const values = Object.values<number>(this.buckets);
    const colors = labels.map(l => this.data.bucketColor(l));
    new Chart(this.bucketChartRef.nativeElement,
      this.chartSvc.bucketDonut(labels, values, colors));
  }

  drawNpaChart() {
    if (!this.npaChartRef || !this.trends.length) return;
    this.destroyChart(this.npaChartRef);
    new Chart(this.npaChartRef.nativeElement,
      this.chartSvc.barChart(
        this.trends.map(t => t.month),
        [{ label: 'NPA Count', data: this.trends.map(t => t.npa_count), color: '#7c3aed' }],
      ));
  }

  bucketEntries(): [string, number][] { return Object.entries(this.buckets); }

  dpdColor(dpd: number): string {
    if (dpd > 120) return '#7c3aed';
    if (dpd > 90)  return '#ef4444';
    if (dpd > 60)  return '#f97316';
    if (dpd > 30)  return '#f59e0b';
    return '#10b981';
  }

  collColor(v: number): string { return v >= 90 ? '#10b981' : v >= 70 ? '#f59e0b' : '#ef4444'; }

  bucketBadge(b: string): string {
    return ({ B0:'badge-regular', B1:'badge-moderate', B2:'badge-risk',
              'B3':'badge-critical', 'B4+':'badge-critical', NPA:'badge-very-critical' } as any)[b] ?? 'badge';
  }

  alertBadge(a: string): string {
    return ({
      'REGULAR':       'badge-regular',
      'MODERATE':      'badge-moderate',
      'RISK':          'badge-risk',
      'CRITICAL':      'badge-critical',
      'VERY CRITICAL': 'badge-very-critical',
    } as any)[a] ?? 'badge';
  }
}
