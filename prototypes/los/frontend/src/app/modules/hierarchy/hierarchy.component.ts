import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-hierarchy',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-4 space-y-4 animate-fade-in">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-800">Hierarchy View</h1>
          <p class="text-sm text-gray-500">State → Branch → RM drill-down performance</p>
        </div>
        <select class="input-base w-36" [(ngModel)]="selectedMonth" (change)="load()">
          <option value="">Latest</option>
          <option *ngFor="let m of data.months" [value]="m.label">{{m.display}}</option>
        </select>
      </div>

      <div *ngIf="loading" class="card text-center py-8 text-gray-400">Loading hierarchy…</div>

      <div *ngIf="!loading" class="space-y-3">
        <div *ngFor="let state of stateEntries()" class="card overflow-hidden">
          <!-- State row -->
          <div class="flex items-center justify-between cursor-pointer py-1"
               (click)="toggleState(state[0])">
            <div class="flex items-center gap-3">
              <span class="text-lg">🗺️</span>
              <div>
                <p class="font-semibold text-gray-800">{{state[0]}}</p>
                <p class="text-xs text-gray-500">{{state[1].total | number}} loans</p>
              </div>
            </div>
            <div class="flex items-center gap-6">
              <div class="text-right">
                <p class="text-xs text-gray-400">NPA</p>
                <p class="font-bold text-purple-600">{{state[1].npa}}</p>
              </div>
              <div class="text-right">
                <p class="text-xs text-gray-400">Coll %</p>
                <p class="font-bold" [style.color]="collColor(state[1].coll_eff)">
                  {{state[1].coll_eff?.toFixed(1)}}%
                </p>
              </div>
              <!-- NPA bar -->
              <div class="w-24 bg-gray-100 rounded-full h-2 hidden sm:block">
                <div class="h-2 rounded-full bg-purple-400"
                     [style.width.%]="state[1].npa / state[1].total * 100"></div>
              </div>
              <span class="text-gray-400 text-sm">{{expandedStates[state[0]] ? '▲' : '▼'}}</span>
            </div>
          </div>

          <!-- Branches -->
          <div *ngIf="expandedStates[state[0]]" class="border-t border-gray-100 mt-2 pt-2">
            <div class="overflow-x-auto">
              <table class="table-base">
                <thead>
                  <tr>
                    <th>Branch</th><th>Total Loans</th><th>NPA Count</th>
                    <th>NPA Rate %</th><th>Coll Eff %</th><th>Risk Bar</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let br of branchEntries(state[1].branches)">
                    <td class="font-medium">🏢 {{br[0]}}</td>
                    <td>{{br[1].total | number}}</td>
                    <td class="text-purple-600 font-bold">{{br[1].npa}}</td>
                    <td [style.color]="npaRateColor(br[1].npa, br[1].total)">
                      {{(br[1].npa / br[1].total * 100).toFixed(1)}}%
                    </td>
                    <td [style.color]="collColor(br[1].coll_eff)">
                      {{br[1].coll_eff?.toFixed(1)}}%
                    </td>
                    <td>
                      <div class="flex gap-1 w-32">
                        <div class="h-2 rounded-l bg-green-400"
                             [style.flex]="(br[1].total - br[1].npa)"></div>
                        <div class="h-2 rounded-r bg-red-400"
                             [style.flex]="br[1].npa"></div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class HierarchyComponent implements OnInit {
  hierarchy: any    = {};
  loading           = true;
  selectedMonth     = '';
  expandedStates: Record<string, boolean> = {};

  constructor(private api: ApiService, public data: DataService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.hierarchy(this.selectedMonth || undefined).subscribe(d => {
      this.hierarchy = d ?? {};
      this.loading   = false;
      // auto-expand first state
      const first = Object.keys(this.hierarchy)[0];
      if (first) this.expandedStates[first] = true;
    });
  }

  toggleState(s: string) { this.expandedStates[s] = !this.expandedStates[s]; }

  stateEntries(): [string, any][] {
    return Object.entries(this.hierarchy).sort((a: any, b: any) => b[1].npa - a[1].npa);
  }

  branchEntries(branches: any): [string, any][] {
    return Object.entries(branches ?? {}).sort((a: any, b: any) => b[1].npa - a[1].npa);
  }

  collColor(v: number): string { return v >= 90 ? '#10b981' : v >= 70 ? '#f59e0b' : '#ef4444'; }

  npaRateColor(npa: number, total: number): string {
    const rate = npa / total * 100;
    return rate > 5 ? '#ef4444' : rate > 2 ? '#f97316' : '#10b981';
  }
}
