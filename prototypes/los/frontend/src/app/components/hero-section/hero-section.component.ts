import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 px-4 py-4">

      <!-- Critical Pool Count -->
      <div class="metric-card border-l-4 border-red-500 animate-fade-in">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Critical Pool</p>
            <p class="text-3xl font-bold text-gray-800 mt-1">
              {{ summary?.critical_count ?? '—' }}
            </p>
          </div>
          <span class="text-2xl">🚨</span>
        </div>
        <div class="flex items-center gap-1 mt-1">
          <span [class]="summary?.critical_trend >= 0 ? 'trend-up' : 'trend-down'">
            {{ summary?.critical_trend >= 0 ? '↑' : '↓' }}
            {{ abs(summary?.critical_trend) }} loans
          </span>
          <span class="text-xs text-gray-400">vs last month</span>
        </div>
        <div class="sparkline-area bg-red-50 rounded mt-2 h-10 flex items-end px-1 gap-0.5">
          <div *ngFor="let v of sparkCritical" class="flex-1 bg-red-400 rounded-t"
               [style.height.%]="v"></div>
        </div>
      </div>

      <!-- Exposure at Risk -->
      <div class="metric-card border-l-4 border-orange-500 animate-fade-in" style="animation-delay:.05s">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Exposure at Risk</p>
            <p class="text-3xl font-bold text-gray-800 mt-1">
              {{ summary ? data.formatCurrency(summary.exposure_at_risk) : '—' }}
            </p>
          </div>
          <span class="text-2xl">💸</span>
        </div>
        <div class="flex items-center gap-1 mt-1">
          <span [class]="summary?.exposure_trend >= 0 ? 'trend-up' : 'trend-down'">
            {{ summary?.exposure_trend >= 0 ? '↑' : '↓' }}
            {{ summary ? data.formatCurrency(abs(summary.exposure_trend)) : '' }}
          </span>
          <span class="text-xs text-gray-400">vs last month</span>
        </div>
        <div class="sparkline-area bg-orange-50 rounded mt-2 h-10 flex items-end px-1 gap-0.5">
          <div *ngFor="let v of sparkExposure" class="flex-1 bg-orange-400 rounded-t"
               [style.height.%]="v"></div>
        </div>
      </div>

      <!-- Collection Efficiency -->
      <div class="metric-card border-l-4 border-green-500 animate-fade-in" style="animation-delay:.1s">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Collection Eff.</p>
            <p class="text-3xl font-bold text-gray-800 mt-1">
              {{ summary?.collection_eff != null ? summary.collection_eff.toFixed(1) + '%' : '—' }}
            </p>
          </div>
          <span class="text-2xl">💚</span>
        </div>
        <div class="flex items-center gap-1 mt-1">
          <span [class]="summary?.collection_eff_trend >= 0 ? 'trend-down' : 'trend-up'">
            {{ summary?.collection_eff_trend >= 0 ? '↑' : '↓' }}
            {{ abs(summary?.collection_eff_trend).toFixed(1) }}%
          </span>
          <span class="text-xs text-gray-400">vs last month</span>
        </div>
        <div class="sparkline-area bg-green-50 rounded mt-2 h-10 flex items-end px-1 gap-0.5">
          <div *ngFor="let v of sparkColl" class="flex-1 bg-green-400 rounded-t"
               [style.height.%]="v"></div>
        </div>
      </div>

      <!-- NPA Rate -->
      <div class="metric-card border-l-4 border-purple-500 animate-fade-in" style="animation-delay:.15s">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">NPA Rate</p>
            <p class="text-3xl font-bold text-gray-800 mt-1">
              {{ summary?.npa_rate != null ? summary.npa_rate.toFixed(2) + '%' : '—' }}
            </p>
          </div>
          <span class="text-2xl">🔴</span>
        </div>
        <div class="flex items-center gap-1 mt-1">
          <span [class]="summary?.npa_rate_trend >= 0 ? 'trend-up' : 'trend-down'">
            {{ summary?.npa_rate_trend >= 0 ? '↑' : '↓' }}
            {{ abs(summary?.npa_rate_trend).toFixed(2) }}%
          </span>
          <span class="text-xs text-gray-400">vs last month</span>
        </div>
        <div class="sparkline-area bg-purple-50 rounded mt-2 h-10 flex items-end px-1 gap-0.5">
          <div *ngFor="let v of sparkNpa" class="flex-1 bg-purple-400 rounded-t"
               [style.height.%]="v"></div>
        </div>
      </div>
    </div>
  `,
})
export class HeroSectionComponent implements OnInit {
  @Input() summary: any = null;

  sparkCritical = [40, 55, 48, 60, 72, 68];
  sparkExposure = [35, 42, 50, 44, 58, 70];
  sparkColl     = [88, 85, 87, 90, 86, 89];
  sparkNpa      = [2,  2.1, 2.4, 2.2, 2.6, 2.8];

  constructor(public data: DataService) {}

  ngOnInit() {}

  abs(n: number): number { return Math.abs(n ?? 0); }
}
