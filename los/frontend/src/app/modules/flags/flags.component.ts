import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DataService } from '../../services/data.service';
import { ExportService } from '../../services/export.service';

@Component({
  selector: 'app-flags',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-4 space-y-4 animate-fade-in">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-800">Flag Management</h1>
          <p class="text-sm text-gray-500">Monitor and manage loan-level triggered flags</p>
        </div>
        <div class="flex gap-2">
          <select class="input-base w-32" [(ngModel)]="selectedMonth" (change)="load()">
            <option value="">Latest</option>
            <option *ngFor="let m of data.months" [value]="m.label">{{m.display}}</option>
          </select>
          <button class="btn-secondary" (click)="exportCsv()">⬇ Export CSV</button>
        </div>
      </div>

      <!-- Flag summary cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div *ngFor="let f of flagSummary()" class="card text-center py-3">
          <p class="text-2xl mb-1">{{f.icon}}</p>
          <p class="text-xl font-bold text-gray-800">{{f.count}}</p>
          <p class="text-xs text-gray-500">{{f.label}}</p>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="card py-3">
        <div class="flex flex-wrap gap-3 items-center">
          <input [(ngModel)]="search" class="input-base w-48" placeholder="Search loan / branch…"
                 (input)="applyFilter()" />
          <label class="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" [(ngModel)]="showDeathOnly"   (change)="applyFilter()" class="rounded"> Death
          </label>
          <label class="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" [(ngModel)]="showUnreachOnly" (change)="applyFilter()" class="rounded"> Unreachable
          </label>
          <label class="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" [(ngModel)]="showGeoOnly"     (change)="applyFilter()" class="rounded"> Geo Violation
          </label>
          <label class="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" [(ngModel)]="showFamilyOnly"  (change)="applyFilter()" class="rounded"> Family Loan
          </label>
          <span class="ml-auto text-xs text-gray-500">{{filtered.length}} of {{flagData.length}} loans</span>
        </div>
      </div>

      <!-- Flags table -->
      <div class="card p-0 overflow-hidden">
        <div *ngIf="loading" class="p-8 text-center text-gray-400">Loading flags…</div>
        <div *ngIf="!loading" class="overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Loan ID</th><th>Branch</th><th>RM</th><th>DPD</th>
                <th>Outstanding</th><th>Alert</th>
                <th class="text-center">💀 Death</th>
                <th class="text-center">📡 Unreach</th>
                <th class="text-center">📍 Geo</th>
                <th class="text-center">🏦 New Loan</th>
                <th class="text-center">🔒 Pre-close</th>
                <th class="text-center">👨‍👩‍👧 Family</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of paginated">
                <td class="font-mono text-xs">{{r.loan_id}}</td>
                <td>{{r.branch}}</td>
                <td class="text-xs text-gray-500">{{r.rm}}</td>
                <td class="font-bold" [style.color]="dpdColor(r.dpd)">{{r.dpd}}</td>
                <td>{{data.formatCurrency(r.outstanding)}}</td>
                <td><span class="badge" [class]="alertBadge(r.alert_level)">{{r.alert_level}}</span></td>
                <td class="text-center">
                  <span *ngIf="r.flg_death"        class="text-red-600 font-bold">✓</span>
                  <span *ngIf="!r.flg_death"       class="text-gray-300">–</span>
                </td>
                <td class="text-center">
                  <span *ngIf="r.flg_unreachable"  class="text-orange-500 font-bold">✓</span>
                  <span *ngIf="!r.flg_unreachable" class="text-gray-300">–</span>
                </td>
                <td class="text-center">
                  <span *ngIf="r.flg_geo"          class="text-yellow-600 font-bold">✓</span>
                  <span *ngIf="!r.flg_geo"         class="text-gray-300">–</span>
                </td>
                <td class="text-center">
                  <span *ngIf="r.flg_new_loan"     class="text-blue-500 font-bold">✓</span>
                  <span *ngIf="!r.flg_new_loan"    class="text-gray-300">–</span>
                </td>
                <td class="text-center">
                  <span *ngIf="r.flg_preclosure"   class="text-purple-500 font-bold">✓</span>
                  <span *ngIf="!r.flg_preclosure"  class="text-gray-300">–</span>
                </td>
                <td class="text-center">
                  <span *ngIf="r.flg_family_loan"  class="text-teal-500 font-bold">✓</span>
                  <span *ngIf="!r.flg_family_loan" class="text-gray-300">–</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div class="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span class="text-xs text-gray-500">Page {{page}} of {{totalPages}}</span>
          <div class="flex gap-2">
            <button class="btn-secondary text-xs py-1" [disabled]="page<=1" (click)="page=page-1">← Prev</button>
            <button class="btn-secondary text-xs py-1" [disabled]="page>=totalPages" (click)="page=page+1">Next →</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class FlagsComponent implements OnInit {
  flagData: any[]  = [];
  filtered: any[]  = [];
  loading          = true;
  selectedMonth    = '';
  search           = '';
  showDeathOnly    = false;
  showUnreachOnly  = false;
  showGeoOnly      = false;
  showFamilyOnly   = false;
  page             = 1;
  pageSize         = 50;

  constructor(
    private api: ApiService,
    public data: DataService,
    private exportSvc: ExportService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.flags(this.selectedMonth || undefined).subscribe(d => {
      this.flagData = d ?? [];
      this.applyFilter();
      this.loading  = false;
    });
  }

  applyFilter() {
    let f = this.flagData;
    if (this.search)       f = f.filter(r => JSON.stringify(r).toLowerCase().includes(this.search.toLowerCase()));
    if (this.showDeathOnly)    f = f.filter(r => r.flg_death);
    if (this.showUnreachOnly)  f = f.filter(r => r.flg_unreachable);
    if (this.showGeoOnly)      f = f.filter(r => r.flg_geo);
    if (this.showFamilyOnly)   f = f.filter(r => r.flg_family_loan);
    this.filtered = f;
    this.page = 1;
  }

  get totalPages(): number { return Math.ceil(this.filtered.length / this.pageSize); }
  get paginated(): any[]   { return this.filtered.slice((this.page-1)*this.pageSize, this.page*this.pageSize); }

  flagSummary() {
    const d = this.flagData;
    return [
      { icon: '💀', label: 'Death',      count: d.filter(r => r.flg_death).length },
      { icon: '📡', label: 'Unreachable',count: d.filter(r => r.flg_unreachable).length },
      { icon: '📍', label: 'Geo Viol.',  count: d.filter(r => r.flg_geo).length },
      { icon: '🏦', label: 'New Loan',   count: d.filter(r => r.flg_new_loan).length },
      { icon: '🔒', label: 'Pre-Closure',count: d.filter(r => r.flg_preclosure).length },
      { icon: '👨‍👩‍👧', label: 'Family Loan',count: d.filter(r => r.flg_family_loan).length },
    ];
  }

  exportCsv() { this.exportSvc.exportTableToCsv(this.filtered, 'flags_export.csv'); }

  dpdColor(dpd: number): string {
    if (dpd > 120) return '#7c3aed'; if (dpd > 90) return '#ef4444';
    if (dpd > 60) return '#f97316'; if (dpd > 30) return '#f59e0b';
    return '#10b981';
  }

  alertBadge(a: string): string {
    return ({'REGULAR':'badge-regular','MODERATE':'badge-moderate','RISK':'badge-risk',
             'CRITICAL':'badge-critical','VERY CRITICAL':'badge-very-critical'} as any)[a] ?? 'badge';
  }
}
