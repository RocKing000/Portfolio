import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-predictions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-4 space-y-4 animate-fade-in">
      <div>
        <h1 class="text-xl font-bold text-gray-800">Risk Prediction Engine</h1>
        <p class="text-sm text-gray-500">Run any of the 5 trained ML models against a loan account</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Loan search panel -->
        <div class="card lg:col-span-1 space-y-3">
          <p class="section-title">Search Loan</p>
          <input [(ngModel)]="searchQuery" class="input-base" placeholder="Loan ID or Customer ID"
                 (keydown.enter)="searchLoan()" />
          <div class="flex gap-2">
            <select [(ngModel)]="selectedMonth" class="input-base flex-1">
              <option value="">All Months</option>
              <option *ngFor="let m of data.months" [value]="m.label">{{m.display}}</option>
            </select>
            <button class="btn-primary" (click)="searchLoan()">Search</button>
          </div>

          <div *ngIf="loanDetail" class="space-y-2 pt-2 border-t border-gray-100">
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Loan ID</span>
              <span class="font-mono font-medium">{{loanDetail.current?.loan_id}}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">DPD</span>
              <span class="font-bold" [style.color]="dpdColor(loanDetail.current?.dpd)">
                {{loanDetail.current?.dpd}}
              </span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Bucket</span>
              <span class="badge" [class]="bucketBadge(loanDetail.current?.bucket)">
                {{loanDetail.current?.bucket}}
              </span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Outstanding</span>
              <span>{{data.formatCurrency(loanDetail.current?.outstanding)}}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Coll. Eff</span>
              <span>{{loanDetail.current?.collection_eff?.toFixed(1)}}%</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">CB Score</span>
              <span>{{loanDetail.current?.cb_score}}</span>
            </div>
          </div>

          <p *ngIf="searchError" class="text-red-500 text-sm">{{searchError}}</p>
        </div>

        <!-- Model selection + prediction -->
        <div class="card lg:col-span-2 space-y-4">
          <p class="section-title">Select Model & Run</p>

          <div class="grid grid-cols-5 gap-2">
            <button *ngFor="let m of models"
                    (click)="selectModel(m)"
                    [class.ring-2]="activeModel === m.key"
                    [class.ring-blue-500]="activeModel === m.key"
                    class="flex flex-col items-center gap-1 p-3 rounded-xl border border-gray-200
                           hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer bg-white">
              <span class="text-xl">{{m.icon}}</span>
              <span class="text-xs text-center font-medium text-gray-600 leading-tight">{{m.label}}</span>
            </button>
          </div>

          <div *ngIf="!loanDetail && activeModel" class="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            ⚠ Search for a loan first, or use the manual feature entry in the Model Bar above.
          </div>

          <button *ngIf="loanDetail && activeModel"
                  class="btn-primary" (click)="runModel()" [disabled]="predicting">
            {{ predicting ? 'Running Model…' : 'Run ' + modelLabel() }}
          </button>

          <!-- Model accuracy cards -->
          <div *ngIf="metrics" class="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <div *ngFor="let kv of metricsEntries()"
                 class="bg-gray-50 rounded-lg p-3 border border-gray-100 text-center">
              <p class="text-xs text-gray-500 font-medium">{{kv[0] | titlecase}}</p>
              <p class="text-sm font-bold text-gray-700 mt-1">
                {{ kv[1].accuracy != null ? (kv[1].accuracy * 100).toFixed(1)+'%' :
                   'R²=' + kv[1].r2_score }}
              </p>
              <p class="text-xs text-gray-400">
                {{ kv[1].f1_score != null ? 'F1 '+(kv[1].f1_score*100).toFixed(1)+'%' :
                   'MAE '+kv[1].mae }}
              </p>
            </div>
          </div>

          <!-- Prediction result -->
          <div *ngIf="result" class="bg-gray-50 rounded-xl p-4 border border-gray-200 animate-slide-up">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-semibold text-gray-700">Prediction Result</span>
              <span *ngIf="result.confidence"
                    class="badge bg-blue-100 text-blue-700">
                {{(result.confidence * 100).toFixed(1)}}% confidence
              </span>
            </div>
            <div class="text-3xl font-bold" [style.color]="predColor()">
              {{result.prediction}}
            </div>

            <!-- Feature importance bars -->
            <div *ngIf="fiEntries().length" class="mt-4">
              <p class="text-xs text-gray-500 mb-2">Top Feature Drivers</p>
              <div *ngFor="let kv of fiEntries().slice(0,8)" class="flex items-center gap-2 mb-1.5">
                <span class="text-xs text-gray-600 w-32 truncate">{{kv[0]}}</span>
                <div class="flex-1 bg-gray-200 rounded-full h-2">
                  <div class="h-2 rounded-full transition-all duration-500"
                       [style.width.%]="kv[1] / fiMax() * 100"
                       [style.background]="activeModelColor()"></div>
                </div>
                <span class="text-xs text-gray-500 w-12 text-right">
                  {{(kv[1]*100).toFixed(1)}}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Payment history -->
      <div *ngIf="loanDetail?.history?.length" class="card">
        <p class="section-title">Payment History</p>
        <div class="overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Month</th><th>DPD</th><th>Bucket</th><th>Alert Level</th>
                <th>Demand</th><th>Collected</th><th>Coll %</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let h of loanDetail.history">
                <td>{{h.month_label}}</td>
                <td class="font-bold" [style.color]="dpdColor(h.dpd)">{{h.dpd}}</td>
                <td><span class="badge" [class]="bucketBadge(h.bucket)">{{h.bucket}}</span></td>
                <td><span class="badge" [class]="alertBadge(h.alert_level)">{{h.alert_level}}</span></td>
                <td>{{data.formatCurrency(h.demand)}}</td>
                <td>{{data.formatCurrency(h.collected)}}</td>
                <td>{{h.collection_eff?.toFixed(1)}}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class PredictionsComponent implements OnInit {
  searchQuery   = '';
  selectedMonth = '';
  activeModel   = '';
  loanDetail: any = null;
  result: any   = null;
  metrics: any  = null;
  predicting    = false;
  searchError   = '';

  models = [
    { key: 'default-predictor',  label: 'Default\nPredictor',  icon: '⚠️', color: '#ef4444' },
    { key: 'risk-scorer',        label: 'Risk\nScorer',        icon: '🎯', color: '#f97316' },
    { key: 'bucket-forecaster',  label: 'Bucket\nForecast',    icon: '🪣', color: '#f59e0b' },
    { key: 'alert-engine',       label: 'Alert\nEngine',       icon: '🚨', color: '#7c3aed' },
    { key: 'collection-engine',  label: 'Collection\nEngine',  icon: '💰', color: '#10b981' },
  ];

  constructor(private api: ApiService, public data: DataService) {}

  ngOnInit() {
    this.api.modelMetrics().subscribe(m => { this.metrics = m; });
  }

  searchLoan() {
    if (!this.searchQuery.trim()) return;
    this.searchError = '';
    this.loanDetail  = null;
    this.result      = null;
    this.api.loanDetail(this.searchQuery.trim(), this.selectedMonth || undefined).subscribe(d => {
      if (d) this.loanDetail = d;
      else   this.searchError = `Loan "${this.searchQuery}" not found`;
    });
  }

  selectModel(m: any) { this.activeModel = m.key; this.result = null; }

  modelLabel(): string {
    return this.models.find(m => m.key === this.activeModel)?.label.replace('\n', ' ') ?? '';
  }

  runModel() {
    if (!this.loanDetail || !this.activeModel) return;
    this.predicting = true;
    this.result     = null;
    this.api.predict(this.activeModel, {
      loan_id: this.loanDetail.current.loan_id,
      month:   this.selectedMonth || undefined,
    }).subscribe(r => {
      this.predicting = false;
      this.result     = r;
    });
  }

  metricsEntries(): [string, any][] { return this.metrics ? Object.entries(this.metrics) : []; }

  fiEntries(): [string, number][] {
    if (!this.result?.feature_importance) return [];
    return Object.entries<number>(this.result.feature_importance).sort((a,b) => b[1]-a[1]);
  }

  fiMax(): number { const e = this.fiEntries(); return e.length ? Math.max(...e.map(x=>x[1])) : 1; }

  activeModelColor(): string {
    return this.models.find(m => m.key === this.activeModel)?.color ?? '#2563eb';
  }

  predColor(): string {
    const p = String(this.result?.prediction ?? '');
    if (['VERY CRITICAL','NPA','1','Default'].includes(p)) return '#ef4444';
    if (['CRITICAL','B4+'].includes(p))  return '#f97316';
    if (['RISK','B3'].includes(p))       return '#f59e0b';
    return '#10b981';
  }

  dpdColor(dpd: number): string {
    if (dpd > 120) return '#7c3aed'; if (dpd > 90) return '#ef4444';
    if (dpd > 60)  return '#f97316'; if (dpd > 30) return '#f59e0b';
    return '#10b981';
  }

  bucketBadge(b: string): string {
    return ({B0:'badge-regular',B1:'badge-moderate',B2:'badge-risk',
             'B3':'badge-critical','B4+':'badge-critical',NPA:'badge-very-critical'} as any)[b]??'badge';
  }

  alertBadge(a: string): string {
    return ({'REGULAR':'badge-regular','MODERATE':'badge-moderate','RISK':'badge-risk',
             'CRITICAL':'badge-critical','VERY CRITICAL':'badge-very-critical'} as any)[a]??'badge';
  }
}
