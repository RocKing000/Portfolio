import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DataService } from '../../services/data.service';

interface ModelDef {
  key: string;
  label: string;
  icon: string;
  description: string;
  fields: { name: string; label: string; type: 'number' | 'select'; options?: string[] }[];
}

@Component({
  selector: 'app-sticky-model-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sticky top-0 z-40 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800
                shadow-lg px-4 py-2 flex items-center gap-2 overflow-x-auto">

      <span class="text-white font-semibold text-sm whitespace-nowrap mr-2">🧠 Models:</span>

      <button *ngFor="let m of models"
              class="model-bar-btn"
              (click)="openModal(m)">
        {{m.icon}} {{m.label}}
      </button>

      <div class="ml-auto flex items-center gap-2">
        <select class="text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1"
                [(ngModel)]="selectedMonth">
          <option value="">All Months</option>
          <option *ngFor="let m of data.months" [value]="m.label">{{m.display}}</option>
        </select>
      </div>
    </div>

    <!-- Modal -->
    <div *ngIf="activeModel" class="modal-overlay" (click)="closeModal()">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h2 class="text-lg font-bold text-gray-800">
              {{activeModel.icon}} {{activeModel.label}}
            </h2>
            <p class="text-sm text-gray-500 mt-0.5">{{activeModel.description}}</p>
          </div>
          <button (click)="closeModal()" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <!-- Loan ID quick lookup -->
        <div class="mb-4">
          <label class="block text-xs font-medium text-gray-500 mb-1">Quick Lookup by Loan ID</label>
          <div class="flex gap-2">
            <input [(ngModel)]="loanId" class="input-base flex-1"
                   placeholder="e.g. LN000042" />
            <button class="btn-primary" (click)="predictByLoan()" [disabled]="loading()">
              {{ loading() ? 'Running…' : 'Predict' }}
            </button>
          </div>
        </div>

        <div class="text-xs text-gray-400 text-center my-3">— or enter features manually —</div>

        <!-- Feature inputs -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div *ngFor="let f of activeModel.fields">
            <label class="block text-xs font-medium text-gray-500 mb-1">{{f.label}}</label>
            <select *ngIf="f.type === 'select'" [(ngModel)]="featureValues[f.name]"
                    class="input-base">
              <option *ngFor="let o of f.options" [value]="o">{{o}}</option>
            </select>
            <input *ngIf="f.type === 'number'" type="number"
                   [(ngModel)]="featureValues[f.name]"
                   class="input-base" placeholder="0" />
          </div>
        </div>

        <button class="btn-primary w-full mb-4" (click)="predictManual()" [disabled]="loading()">
          {{ loading() ? 'Computing…' : 'Run Model' }}
        </button>

        <!-- Result -->
        <div *ngIf="result" class="bg-gray-50 rounded-xl p-4 border border-gray-200 animate-slide-up">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-gray-700">Prediction</span>
            <span *ngIf="result.confidence"
                  class="badge bg-blue-100 text-blue-700">
              {{(result.confidence * 100).toFixed(1)}}% confidence
            </span>
          </div>
          <div class="text-2xl font-bold mb-3" [style.color]="predColor()">
            {{result.prediction}}
          </div>

          <!-- Probabilities -->
          <div *ngIf="result.probabilities">
            <p class="text-xs text-gray-500 mb-2">Class probabilities</p>
            <div *ngFor="let kv of probEntries()" class="flex items-center gap-2 mb-1">
              <span class="text-xs text-gray-600 w-24 truncate">{{kv[0]}}</span>
              <div class="flex-1 bg-gray-200 rounded-full h-1.5">
                <div class="h-1.5 rounded-full bg-blue-500" [style.width.%]="kv[1]*100"></div>
              </div>
              <span class="text-xs text-gray-500 w-10 text-right">{{(kv[1]*100).toFixed(1)}}%</span>
            </div>
          </div>

          <!-- Feature importance -->
          <div *ngIf="result.feature_importance && fiEntries().length">
            <p class="text-xs text-gray-500 mt-3 mb-2">Top feature drivers</p>
            <div *ngFor="let kv of fiEntries().slice(0,6)" class="flex items-center gap-2 mb-1">
              <span class="text-xs text-gray-600 w-28 truncate">{{kv[0]}}</span>
              <div class="flex-1 bg-gray-200 rounded-full h-1.5">
                <div class="h-1.5 rounded-full bg-purple-500"
                     [style.width.%]="kv[1] / fiMax() * 100"></div>
              </div>
              <span class="text-xs text-gray-500 w-10 text-right">{{(kv[1]*100).toFixed(1)}}%</span>
            </div>
          </div>
        </div>

        <p *ngIf="error" class="text-red-500 text-sm mt-3">{{error}}</p>
      </div>
    </div>
  `,
})
export class StickyModelBarComponent {
  models: ModelDef[] = [
    {
      key: 'default-predictor', label: 'Default Predictor', icon: '⚠️',
      description: 'Predicts probability of loan default using payment and borrower features.',
      fields: [
        { name: 'dpd',           label: 'DPD',              type: 'number' },
        { name: 'outstanding',   label: 'Outstanding (₹)',  type: 'number' },
        { name: 'collection_eff',label: 'Coll. Eff %',      type: 'number' },
        { name: 'cb_score',      label: 'Credit Score',     type: 'number' },
        { name: 'income_monthly',label: 'Monthly Income',   type: 'number' },
        { name: 'shortfall',     label: 'Shortfall (₹)',    type: 'number' },
      ],
    },
    {
      key: 'risk-scorer', label: 'Risk Scorer', icon: '🎯',
      description: 'Assigns a structural risk score (0–100) to a loan account.',
      fields: [
        { name: 'dpd',           label: 'DPD',              type: 'number' },
        { name: 'shortfall',     label: 'Shortfall (₹)',    type: 'number' },
        { name: 'cb_score',      label: 'Credit Score',     type: 'number' },
        { name: 'income_monthly',label: 'Monthly Income',   type: 'number' },
      ],
    },
    {
      key: 'bucket-forecaster', label: 'Bucket Forecast', icon: '🪣',
      description: 'Forecasts next-month DPD bucket (B0 through NPA).',
      fields: [
        { name: 'dpd',           label: 'Current DPD',      type: 'number' },
        { name: 'collection_eff',label: 'Coll. Eff %',      type: 'number' },
        { name: 'outstanding',   label: 'Outstanding (₹)',  type: 'number' },
        { name: 'shortfall',     label: 'Shortfall (₹)',    type: 'number' },
      ],
    },
    {
      key: 'alert-engine', label: 'Alert Engine', icon: '🚨',
      description: 'Classifies alert level: REGULAR → VERY CRITICAL.',
      fields: [
        { name: 'dpd',           label: 'DPD',              type: 'number' },
        { name: 'collection_eff',label: 'Coll. Eff %',      type: 'number' },
        { name: 'shortfall',     label: 'Shortfall (₹)',    type: 'number' },
        { name: 'outstanding',   label: 'Outstanding (₹)',  type: 'number' },
        { name: 'cb_score',      label: 'Credit Score',     type: 'number' },
      ],
    },
    {
      key: 'collection-engine', label: 'Collection Forecast', icon: '💰',
      description: 'Predicts expected collection efficiency % for next cycle.',
      fields: [
        { name: 'dpd',           label: 'DPD',              type: 'number' },
        { name: 'income_monthly',label: 'Monthly Income',   type: 'number' },
        { name: 'loan_amount',   label: 'Loan Amount (₹)',  type: 'number' },
        { name: 'cb_score',      label: 'Credit Score',     type: 'number' },
      ],
    },
  ];

  activeModel: ModelDef | null = null;
  loanId         = '';
  selectedMonth  = '';
  featureValues: Record<string, number> = {};
  result: any    = null;
  error          = '';
  loading        = signal(false);

  constructor(private api: ApiService, public data: DataService) {}

  openModal(m: ModelDef) {
    this.activeModel   = m;
    this.result        = null;
    this.error         = '';
    this.loanId        = '';
    this.featureValues = {};
    m.fields.forEach(f => { this.featureValues[f.name] = 0; });
  }

  closeModal() { this.activeModel = null; }

  predictByLoan() {
    if (!this.activeModel || !this.loanId.trim()) return;
    this.loading.set(true);
    this.result = null; this.error = '';
    this.api.predict(this.activeModel.key, {
      loan_id: this.loanId.trim(),
      month:   this.selectedMonth || undefined,
    }).subscribe(r => {
      this.loading.set(false);
      if (r) this.result = r; else this.error = 'Prediction failed — check loan ID';
    });
  }

  predictManual() {
    if (!this.activeModel) return;
    this.loading.set(true);
    this.result = null; this.error = '';
    this.api.predict(this.activeModel.key, { features: this.featureValues })
      .subscribe(r => {
        this.loading.set(false);
        if (r) this.result = r; else this.error = 'Prediction failed';
      });
  }

  probEntries(): [string, number][] {
    if (!this.result?.probabilities) return [];
    return Object.entries<number>(this.result.probabilities).sort((a, b) => b[1] - a[1]);
  }

  fiEntries(): [string, number][] {
    if (!this.result?.feature_importance) return [];
    return Object.entries<number>(this.result.feature_importance).sort((a, b) => b[1] - a[1]);
  }

  fiMax(): number {
    const entries = this.fiEntries();
    return entries.length ? Math.max(...entries.map(e => e[1])) : 1;
  }

  predColor(): string {
    const p = String(this.result?.prediction ?? '');
    if (['VERY CRITICAL', 'NPA', '1', 'Default'].includes(p)) return '#ef4444';
    if (['CRITICAL', 'B4+'].includes(p))    return '#f97316';
    if (['RISK', 'B3'].includes(p))         return '#f59e0b';
    if (['MODERATE', 'B2'].includes(p))     return '#84cc16';
    return '#10b981';
  }
}
