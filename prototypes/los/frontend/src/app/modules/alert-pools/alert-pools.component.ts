import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DataService } from '../../services/data.service';
import { ExportService } from '../../services/export.service';

interface PoolTab {
  name: string;
  label: string;
  color: string;
  bgClass: string;
  actions: string[];
}

@Component({
  selector: 'app-alert-pools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-4 space-y-4 animate-fade-in">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-800">Alert Pools</h1>
          <p class="text-sm text-gray-500">Segmented loan pools by risk alert level</p>
        </div>
        <select class="input-base w-36" [(ngModel)]="selectedMonth" (change)="loadPool()">
          <option value="">Latest</option>
          <option *ngFor="let m of data.months" [value]="m.label">{{m.display}}</option>
        </select>
      </div>

      <!-- Pool tabs -->
      <div class="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button *ngFor="let p of pools"
                (click)="selectPool(p)"
                [class.active]="activePool === p.name"
                [class.inactive]="activePool !== p.name"
                class="pool-tab">
          <span [style.color]="p.color">●</span> {{p.label}}
        </button>
      </div>

      <!-- Pool summary -->
      <div *ngIf="poolData" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="card text-center">
          <p class="text-xs text-gray-500">Loan Count</p>
          <p class="text-2xl font-bold text-gray-800">{{poolData.count | number}}</p>
        </div>
        <div class="card text-center">
          <p class="text-xs text-gray-500">Outstanding</p>
          <p class="text-2xl font-bold text-gray-800">{{data.formatCurrency(poolData.outstanding)}}</p>
        </div>
        <div class="card text-center">
          <p class="text-xs text-gray-500">Shortfall</p>
          <p class="text-2xl font-bold text-red-600">{{data.formatCurrency(poolData.shortfall)}}</p>
        </div>
        <div class="card text-center">
          <p class="text-xs text-gray-500">Avg DPD</p>
          <p class="text-2xl font-bold" [style.color]="activeTabColor()">{{poolData.avg_dpd?.toFixed(0)}}</p>
        </div>
      </div>

      <!-- Recommended actions -->
      <div *ngIf="currentPool" class="card border-l-4" [style.border-color]="currentPool.color">
        <p class="section-title">Recommended Actions</p>
        <ul class="space-y-1.5">
          <li *ngFor="let a of currentPool.actions" class="flex items-start gap-2 text-sm text-gray-700">
            <span class="text-blue-500 mt-0.5">→</span> {{a}}
          </li>
        </ul>
      </div>

      <!-- Export + search -->
      <div class="flex gap-2 items-center">
        <input [(ngModel)]="search" class="input-base flex-1 max-w-xs" placeholder="Search loans…"
               (input)="applySearch()" />
        <button class="btn-secondary" (click)="exportPool()">⬇ Export to Excel</button>
      </div>

      <!-- Pool loans table -->
      <div class="card p-0 overflow-hidden">
        <div *ngIf="loading" class="p-8 text-center text-gray-400">Loading pool…</div>
        <div *ngIf="!loading" class="overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Loan ID</th><th>Customer ID</th><th>Branch</th>
                <th>DPD</th><th>Outstanding</th><th>Shortfall</th><th>Coll %</th><th>Bucket</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of displayedLoans"
                  [style.background]="activePool === 'VERY CRITICAL' ? '#fff5f5' : ''">
                <td class="font-mono text-xs">{{r.loan_id}}</td>
                <td class="text-xs text-gray-500">{{r.customer_id}}</td>
                <td>{{r.branch}}</td>
                <td class="font-bold" [style.color]="dpdColor(r.dpd)">{{r.dpd}}</td>
                <td>{{data.formatCurrency(r.outstanding)}}</td>
                <td class="text-red-600">{{data.formatCurrency(r.shortfall)}}</td>
                <td [style.color]="collColor(r.collection_eff)">{{r.collection_eff?.toFixed(1)}}%</td>
                <td><span class="badge" [class]="bucketBadge(r.bucket)">{{r.bucket}}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
          Showing {{displayedLoans.length}} of {{poolData?.count ?? 0}} loans (first 100)
        </div>
      </div>
    </div>
  `,
})
export class AlertPoolsComponent implements OnInit {
  pools: PoolTab[] = [
    {
      name: 'REGULAR', label: 'Regular', color: '#10b981', bgClass: 'bg-green-50',
      actions: [
        'Continue standard collection process',
        'Monthly CRM check-in',
        'No special intervention required',
        'Monitor for DPD creep',
      ],
    },
    {
      name: 'MODERATE', label: 'Moderate', color: '#f59e0b', bgClass: 'bg-yellow-50',
      actions: [
        'Increase call frequency to fortnightly',
        'Field visit if 2 consecutive missed EMIs',
        'Send payment reminder SMS 5 days before due date',
        'Review group meeting attendance',
      ],
    },
    {
      name: 'RISK', label: 'Risk', color: '#f97316', bgClass: 'bg-orange-50',
      actions: [
        'Assign dedicated collection officer',
        'Weekly field visit mandatory',
        'Explore restructuring options',
        'Escalate to Branch Manager',
        'Check for unreachability flag',
      ],
    },
    {
      name: 'CRITICAL', label: 'Critical', color: '#ef4444', bgClass: 'bg-red-50',
      actions: [
        'Immediate field visit within 48 hours',
        'RM + BM joint visit required',
        'Legal notice preparation',
        'Guarantee activation process',
        'Daily monitoring by Branch Manager',
      ],
    },
    {
      name: 'VERY CRITICAL', label: 'Very Critical', color: '#7c3aed', bgClass: 'bg-purple-50',
      actions: [
        'NPA classification — trigger provisioning',
        'Legal proceedings initiation',
        'SARFAESI/DRT action evaluation',
        'Write-off consideration for >180 DPD',
        'Escalate to Regional Head and Legal',
        'Document all recovery attempts',
      ],
    },
  ];

  activePool    = 'CRITICAL';
  currentPool?: PoolTab;
  poolData: any = null;
  selectedMonth = '';
  loading       = true;
  search        = '';
  displayedLoans: any[] = [];

  constructor(
    private api: ApiService,
    public data: DataService,
    private exportSvc: ExportService,
  ) {}

  ngOnInit() {
    this.currentPool = this.pools.find(p => p.name === this.activePool);
    this.loadPool();
  }

  selectPool(p: PoolTab) {
    this.activePool  = p.name;
    this.currentPool = p;
    this.loadPool();
  }

  loadPool() {
    this.loading = true;
    this.api.pool(this.activePool, this.selectedMonth || undefined).subscribe(d => {
      this.poolData     = d;
      this.displayedLoans = d?.loans ?? [];
      this.loading      = false;
    });
  }

  applySearch() {
    if (!this.search.trim()) {
      this.displayedLoans = this.poolData?.loans ?? [];
    } else {
      const q = this.search.toLowerCase();
      this.displayedLoans = (this.poolData?.loans ?? []).filter((r: any) =>
        JSON.stringify(r).toLowerCase().includes(q)
      );
    }
  }

  activeTabColor(): string { return this.currentPool?.color ?? '#6b7280'; }

  exportPool() { this.exportSvc.downloadPool(this.activePool, this.selectedMonth || undefined); }

  dpdColor(dpd: number): string {
    if (dpd > 120) return '#7c3aed'; if (dpd > 90) return '#ef4444';
    if (dpd > 60) return '#f97316'; if (dpd > 30) return '#f59e0b';
    return '#10b981';
  }

  collColor(v: number): string { return v >= 90 ? '#10b981' : v >= 70 ? '#f59e0b' : '#ef4444'; }

  bucketBadge(b: string): string {
    return ({B0:'badge-regular',B1:'badge-moderate',B2:'badge-risk',
             'B3':'badge-critical','B4+':'badge-critical',NPA:'badge-very-critical'} as any)[b] ?? 'badge';
  }
}
