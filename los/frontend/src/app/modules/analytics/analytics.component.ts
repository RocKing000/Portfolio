import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart } from 'chart.js';
import { ApiService } from '../../services/api.service';
import { DataService } from '../../services/data.service';
import { ChartService } from '../../services/chart.service';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-4 space-y-4 animate-fade-in">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-800">Payment Analytics</h1>
          <p class="text-sm text-gray-500">6-month portfolio trends and DPD analysis</p>
        </div>
      </div>

      <!-- 6-month trend -->
      <div class="card">
        <p class="section-title">Demand vs Collection — 6 Month View</p>
        <div class="chart-wrapper" style="height:280px">
          <canvas #trendChart></canvas>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Collection Efficiency trend -->
        <div class="card">
          <p class="section-title">Collection Efficiency % by Month</p>
          <div class="chart-wrapper" style="height:220px">
            <canvas #collChart></canvas>
          </div>
        </div>

        <!-- Shortfall trend -->
        <div class="card">
          <p class="section-title">Shortfall by Month</p>
          <div class="chart-wrapper" style="height:220px">
            <canvas #shortfallChart></canvas>
          </div>
        </div>
      </div>

      <!-- Bucket movement matrix -->
      <div class="card">
        <p class="section-title">Bucket Migration Matrix (Previous → Current Month)</p>
        <div *ngIf="!matrixLoaded" class="text-sm text-gray-400 py-6 text-center">Loading matrix…</div>
        <div *ngIf="matrixLoaded" class="overflow-x-auto">
          <table class="table-base text-center">
            <thead>
              <tr>
                <th class="text-left">From \ To</th>
                <th *ngFor="let b of buckets">{{b}}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let fb of buckets">
                <td class="font-medium text-left">
                  <span class="badge" [class]="bucketBadge(fb)">{{fb}}</span>
                </td>
                <td *ngFor="let tb of buckets"
                    [class]="cellClass(fb, tb)"
                    class="font-mono">
                  {{matrix[fb]?.[tb] ?? 0}}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-xs text-gray-400 mt-2">
          Diagonal = stayed in bucket. Off-diagonal = migrated. Dark red = deterioration.
        </p>
      </div>

      <!-- Monthly stats table -->
      <div class="card">
        <p class="section-title">Monthly Summary</p>
        <div class="overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr><th>Month</th><th>Loans</th><th>Demand</th><th>Collected</th><th>Shortfall</th><th>Coll %</th><th>NPA</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let t of trends">
                <td class="font-medium">{{t.month}}</td>
                <td>{{t.total_loans | number}}</td>
                <td>{{data.formatCurrency(t.demand)}}</td>
                <td>{{data.formatCurrency(t.collected)}}</td>
                <td class="text-red-600">{{data.formatCurrency(t.shortfall)}}</td>
                <td [style.color]="collColor(t.collection_eff)">{{t.collection_eff?.toFixed(1)}}%</td>
                <td class="text-purple-600 font-bold">{{t.npa_count}}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class AnalyticsComponent implements OnInit, AfterViewInit {
  @ViewChild('trendChart')    trendRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('collChart')     collRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('shortfallChart') sfRef!: ElementRef<HTMLCanvasElement>;

  trends: any[] = [];
  matrix: any   = {};
  matrixLoaded  = false;
  buckets       = ['B0','B1','B2','B3','B4+','NPA'];

  constructor(
    private api: ApiService,
    public data: DataService,
    private chartSvc: ChartService,
  ) {}

  ngOnInit() {
    this.api.trends().subscribe(d => {
      this.trends = d ?? [];
      this.drawCharts();
    });
    this.api.bucketMovement().subscribe(d => {
      this.matrix = d ?? {};
      this.matrixLoaded = true;
    });
  }

  ngAfterViewInit() { this.drawCharts(); }

  drawCharts() {
    if (!this.trends.length) return;
    setTimeout(() => {
      this.destroyAndDraw(this.trendRef, this.chartSvc.trendLine(
        this.trends.map(t => t.month),
        this.trends.map(t => t.demand),
        this.trends.map(t => t.collected),
      ));
      this.destroyAndDraw(this.collRef, this.chartSvc.barChart(
        this.trends.map(t => t.month),
        [{ label: 'Collection Eff %', data: this.trends.map(t => t.collection_eff), color: '#10b981' }],
      ));
      this.destroyAndDraw(this.sfRef, this.chartSvc.barChart(
        this.trends.map(t => t.month),
        [{ label: 'Shortfall (₹)', data: this.trends.map(t => t.shortfall), color: '#ef4444' }],
      ));
    }, 100);
  }

  private destroyAndDraw(ref: ElementRef<HTMLCanvasElement>, cfg: any) {
    if (!ref) return;
    const old = Chart.getChart(ref.nativeElement);
    if (old) old.destroy();
    new Chart(ref.nativeElement, cfg);
  }

  cellClass(fb: string, tb: string): string {
    const v   = this.matrix[fb]?.[tb] ?? 0;
    const bIdx = this.buckets.indexOf(tb);
    const fIdx = this.buckets.indexOf(fb);
    if (fb === tb)    return 'bg-green-50 text-green-700 font-bold';
    if (bIdx > fIdx)  return v > 50 ? 'bg-red-200 text-red-800' : 'bg-red-50 text-red-600';
    return 'bg-gray-50 text-gray-500';
  }

  collColor(v: number): string { return v >= 90 ? '#10b981' : v >= 70 ? '#f59e0b' : '#ef4444'; }

  bucketBadge(b: string): string {
    return ({B0:'badge-regular',B1:'badge-moderate',B2:'badge-risk',
             'B3':'badge-critical','B4+':'badge-critical',NPA:'badge-very-critical'} as any)[b]??'badge';
  }
}
