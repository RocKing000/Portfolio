import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, combineLatest, tap } from 'rxjs';
import { ApiService } from './api.service';

export type AlertLevel = 'REGULAR' | 'MODERATE' | 'RISK' | 'CRITICAL' | 'VERY CRITICAL';

@Injectable({ providedIn: 'root' })
export class DataService {
  /** Reactive state */
  private _summary$    = new BehaviorSubject<any>(null);
  private _trends$     = new BehaviorSubject<any[]>([]);
  private _buckets$    = new BehaviorSubject<any>(null);
  private _topCritical$ = new BehaviorSubject<any[]>([]);
  private _loading$    = new BehaviorSubject<boolean>(false);
  private _selectedMonth$ = new BehaviorSubject<string>('');

  summary$     = this._summary$.asObservable();
  trends$      = this._trends$.asObservable();
  buckets$     = this._buckets$.asObservable();
  topCritical$ = this._topCritical$.asObservable();
  loading$     = this._loading$.asObservable();
  selectedMonth$ = this._selectedMonth$.asObservable();

  readonly months = [
    { label: '2025-10', display: 'Oct 2025' },
    { label: '2025-11', display: 'Nov 2025' },
    { label: '2025-12', display: 'Dec 2025' },
    { label: '2026-01', display: 'Jan 2026' },
    { label: '2026-02', display: 'Feb 2026' },
    { label: '2026-03', display: 'Mar 2026' },
  ];

  constructor(private api: ApiService) {}

  loadDashboard() {
    this._loading$.next(true);
    this.api.summary().subscribe(d => { if (d) this._summary$.next(d); });
    this.api.trends().subscribe(d => { if (d) this._trends$.next(d); });
    this.api.buckets(this._selectedMonth$.value || undefined).subscribe(d => {
      if (d) this._buckets$.next(d);
    });
    this.api.topCritical(10).subscribe(d => {
      if (d) this._topCritical$.next(d);
      this._loading$.next(false);
    });
  }

  setMonth(m: string) {
    this._selectedMonth$.next(m);
    this.loadDashboard();
  }

  alertColor(level: string): string {
    return ({
      'REGULAR':       '#10b981',
      'MODERATE':      '#f59e0b',
      'RISK':          '#f97316',
      'CRITICAL':      '#ef4444',
      'VERY CRITICAL': '#7c3aed',
    } as any)[level] ?? '#6b7280';
  }

  bucketColor(bucket: string): string {
    return ({
      'B0':  '#10b981',
      'B1':  '#84cc16',
      'B2':  '#f59e0b',
      'B3':  '#f97316',
      'B4+': '#ef4444',
      'NPA': '#7c3aed',
    } as any)[bucket] ?? '#6b7280';
  }

  formatCurrency(n: number): string {
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
    return `₹${n.toLocaleString('en-IN')}`;
  }
}
