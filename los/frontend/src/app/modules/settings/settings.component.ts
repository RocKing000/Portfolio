import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-4 space-y-4 animate-fade-in">
      <div>
        <h1 class="text-xl font-bold text-gray-800">Settings</h1>
        <p class="text-sm text-gray-500">System configuration and model parameters</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- API config -->
        <div class="card space-y-3">
          <p class="section-title">API Configuration</p>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Backend URL</label>
            <input [(ngModel)]="apiUrl" class="input-base" />
          </div>
          <div class="flex items-center gap-2">
            <button class="btn-primary" (click)="testApi()">Test Connection</button>
            <span *ngIf="apiStatus === 'ok'"   class="text-green-600 text-sm">✓ Connected</span>
            <span *ngIf="apiStatus === 'fail'" class="text-red-600 text-sm">✗ Failed</span>
          </div>
        </div>

        <!-- Alert thresholds -->
        <div class="card space-y-3">
          <p class="section-title">Alert Thresholds (DPD)</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">REGULAR (0 DPD)</label>
              <input type="number" [(ngModel)]="thresholds.regular" class="input-base" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">MODERATE (≤30)</label>
              <input type="number" [(ngModel)]="thresholds.moderate" class="input-base" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">RISK (≤60)</label>
              <input type="number" [(ngModel)]="thresholds.risk" class="input-base" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">CRITICAL (≤90)</label>
              <input type="number" [(ngModel)]="thresholds.critical" class="input-base" />
            </div>
          </div>
          <p class="text-xs text-gray-400">Note: thresholds are display-only in demo mode. Backend uses trained model logic.</p>
        </div>

        <!-- System info -->
        <div class="card lg:col-span-2">
          <p class="section-title">System Information</p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p class="text-xs text-gray-400">Frontend</p>
              <p class="font-medium">Angular 16</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Styling</p>
              <p class="font-medium">Tailwind CSS</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Charts</p>
              <p class="font-medium">Chart.js</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Backend</p>
              <p class="font-medium">Flask 3.0</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">ML Models</p>
              <p class="font-medium">scikit-learn</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Dataset</p>
              <p class="font-medium">2,000 JLG Loans</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Time Period</p>
              <p class="font-medium">Oct 2025 – Mar 2026</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">API Port</p>
              <p class="font-medium">5001</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SettingsComponent {
  apiUrl    = 'http://localhost:5001/api';
  apiStatus = '';
  thresholds = { regular: 0, moderate: 30, risk: 60, critical: 90 };

  constructor(private api: ApiService) {}

  testApi() {
    this.apiStatus = '';
    this.api.health().subscribe(d => {
      this.apiStatus = d ? 'ok' : 'fail';
    });
  }
}
