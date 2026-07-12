import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DataService } from '../../services/data.service';
import { ExportService } from '../../services/export.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-4 space-y-4 animate-fade-in">
      <div>
        <h1 class="text-xl font-bold text-gray-800">Reports</h1>
        <p class="text-sm text-gray-500">Management report preview and custom export builder</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Report builder -->
        <div class="card space-y-3">
          <p class="section-title">Custom Report Builder</p>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Report Type</label>
            <select [(ngModel)]="reportType" class="input-base">
              <option value="portfolio">Portfolio Summary</option>
              <option value="npa">NPA Report</option>
              <option value="flags">Flag Report</option>
              <option value="bucket">Bucket Distribution</option>
              <option value="pool_critical">Critical Pool</option>
              <option value="pool_very_critical">Very Critical Pool</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <select [(ngModel)]="selectedMonth" class="input-base">
              <option value="">Latest</option>
              <option *ngFor="let m of data.months" [value]="m.label">{{m.display}}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Export Format</label>
            <div class="flex gap-2">
              <label class="flex items-center gap-1.5 text-sm">
                <input type="radio" [(ngModel)]="exportFormat" value="csv"> CSV
              </label>
              <label class="flex items-center gap-1.5 text-sm">
                <input type="radio" [(ngModel)]="exportFormat" value="excel"> Excel
              </label>
            </div>
          </div>
          <button class="btn-primary w-full" (click)="runReport()" [disabled]="generating">
            {{ generating ? 'Generating…' : '⬇ Generate Report' }}
          </button>
          <p *ngIf="reportMsg" class="text-xs text-green-600">{{reportMsg}}</p>
        </div>

        <!-- Management report preview -->
        <div class="card lg:col-span-2 space-y-4">
          <div class="flex items-center justify-between">
            <p class="section-title mb-0">Management Report Preview</p>
            <span class="text-xs text-gray-400">{{selectedMonth || 'Latest Month'}}</span>
          </div>

          <div *ngIf="summary" class="space-y-4">
            <!-- KPI strip -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="bg-red-50 rounded-lg p-3 text-center">
                <p class="text-xs text-gray-500">Critical Loans</p>
                <p class="text-xl font-bold text-red-600">{{summary.critical_count}}</p>
              </div>
              <div class="bg-orange-50 rounded-lg p-3 text-center">
                <p class="text-xs text-gray-500">Exposure at Risk</p>
                <p class="text-xl font-bold text-orange-600">{{data.formatCurrency(summary.exposure_at_risk)}}</p>
              </div>
              <div class="bg-green-50 rounded-lg p-3 text-center">
                <p class="text-xs text-gray-500">Coll. Eff</p>
                <p class="text-xl font-bold text-green-600">{{summary.collection_eff?.toFixed(1)}}%</p>
              </div>
              <div class="bg-purple-50 rounded-lg p-3 text-center">
                <p class="text-xs text-gray-500">NPA Rate</p>
                <p class="text-xl font-bold text-purple-600">{{summary.npa_rate?.toFixed(2)}}%</p>
              </div>
            </div>

            <!-- Bucket dist preview -->
            <div *ngIf="buckets">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bucket Distribution</p>
              <div class="space-y-1.5">
                <div *ngFor="let b of bucketEntries()" class="flex items-center gap-2">
                  <span class="text-xs font-medium w-8" [style.color]="data.bucketColor(b[0])">{{b[0]}}</span>
                  <div class="flex-1 bg-gray-100 rounded-full h-2">
                    <div class="h-2 rounded-full"
                         [style.width.%]="b[1] / bucketTotal() * 100"
                         [style.background]="data.bucketColor(b[0])"></div>
                  </div>
                  <span class="text-xs text-gray-500 w-10 text-right">{{b[1]}}</span>
                </div>
              </div>
            </div>

            <!-- Trend summary -->
            <div *ngIf="trends.length">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">6-Month Trend</p>
              <div class="overflow-x-auto">
                <table class="table-base text-xs">
                  <thead>
                    <tr><th>Month</th><th>Loans</th><th>Coll %</th><th>NPA</th></tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let t of trends">
                      <td>{{t.month}}</td>
                      <td>{{t.total_loans}}</td>
                      <td [style.color]="collColor(t.collection_eff)">{{t.collection_eff?.toFixed(1)}}%</td>
                      <td class="text-purple-600 font-bold">{{t.npa_count}}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div *ngIf="!summary" class="text-center py-8 text-gray-400">Loading report…</div>
        </div>
      </div>
    </div>
  `,
})
export class ReportsComponent implements OnInit {
  summary: any    = null;
  buckets: any    = null;
  trends: any[]   = [];
  selectedMonth   = '';
  reportType      = 'portfolio';
  exportFormat    = 'csv';
  generating      = false;
  reportMsg       = '';

  constructor(
    private api: ApiService,
    public data: DataService,
    private exportSvc: ExportService,
  ) {}

  ngOnInit() {
    this.api.summary().subscribe(d => { this.summary = d; });
    this.api.buckets().subscribe(d => { this.buckets = d; });
    this.api.trends().subscribe(d => { this.trends = d ?? []; });
  }

  bucketEntries(): [string, number][] { return this.buckets ? Object.entries(this.buckets) : []; }
  bucketTotal(): number { return this.bucketEntries().reduce((s,[,v]) => s+v, 0) || 1; }
  collColor(v: number): string { return v >= 90 ? '#10b981' : v >= 70 ? '#f59e0b' : '#ef4444'; }

  runReport() {
    this.generating = true;
    this.reportMsg  = '';

    if (this.reportType.startsWith('pool_')) {
      const pool = this.reportType === 'pool_critical' ? 'CRITICAL' : 'VERY CRITICAL';
      this.exportSvc.downloadPool(pool, this.selectedMonth || undefined);
      this.generating = false;
      this.reportMsg  = `${pool} pool exported to Excel`;
      return;
    }

    // For CSV reports, gather data then export
    const fetch$ = this.reportType === 'flags'
      ? this.api.flags(this.selectedMonth || undefined)
      : this.reportType === 'bucket'
        ? this.api.buckets(this.selectedMonth || undefined)
        : this.api.loans({ month: this.selectedMonth || undefined, size: 2000 });

    fetch$.subscribe((d: any) => {
      const rows = Array.isArray(d) ? d : (d?.loans ?? [d]);
      this.exportSvc.exportTableToCsv(rows, `${this.reportType}_${this.selectedMonth || 'latest'}.csv`);
      this.generating = false;
      this.reportMsg  = 'Report downloaded successfully';
    });
  }
}
