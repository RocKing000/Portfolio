import { Injectable, inject, signal, computed } from '@angular/core';
import { Signal as SignalModel, SignalDetails, SignalAggregation } from '../models/signal.model';
import { SignalService } from './signal.service';

@Injectable({ providedIn: 'root' })
export class SignalStore {
  private readonly signalService = inject(SignalService);

  // State
  private readonly _signals        = signal<SignalModel[]>([]);
  private readonly _selectedSignal = signal<SignalDetails | null>(null);
  private readonly _aggregations   = signal<SignalAggregation[]>([]);
  private readonly _loading        = signal(false);
  private readonly _error          = signal<string | null>(null);

  // Filter state
  private readonly _signalTypeFilter = signal<string | undefined>(undefined);
  private readonly _severityFilter   = signal<number | undefined>(undefined);
  private readonly _statusFilter     = signal<string | undefined>(undefined);

  // Public read-only
  readonly signals        = this._signals.asReadonly();
  readonly selectedSignal = this._selectedSignal.asReadonly();
  readonly aggregations   = this._aggregations.asReadonly();
  readonly loading        = this._loading.asReadonly();
  readonly error          = this._error.asReadonly();

  readonly criticalSignals = computed(() =>
    this._signals().filter(s => s.severity === 4)
  );

  readonly filteredSignals = computed(() => {
    let list = this._signals();
    const type     = this._signalTypeFilter();
    const severity = this._severityFilter();
    const status   = this._statusFilter();

    if (type)     list = list.filter(s => s.signalType === type);
    if (severity) list = list.filter(s => s.severity >= severity);
    if (status)   list = list.filter(s => s.status === status);
    return list;
  });

  // Actions
  async loadSignals(topN = 50): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const resp = await this.signalService
        .getOpenSignals(topN, this._severityFilter(), this._signalTypeFilter())
        .toPromise();
      if (resp?.success) this._signals.set(resp.data);
    } catch (err: any) {
      this._error.set(err?.message ?? 'Failed to load signals');
    } finally {
      this._loading.set(false);
    }
  }

  async loadSignalDetails(id: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const resp = await this.signalService.getSignalDetails(id).toPromise();
      if (resp?.success) this._selectedSignal.set(resp.data);
    } catch (err: any) {
      this._error.set(err?.message ?? 'Failed to load signal details');
    } finally {
      this._loading.set(false);
    }
  }

  async loadAggregations(periodType = 'DAY', lastN = 30): Promise<void> {
    try {
      const resp = await this.signalService.getAggregations(periodType, lastN).toPromise();
      if (resp?.success) this._aggregations.set(resp.data);
    } catch { /* non-critical */ }
  }

  clearSelectedSignal(): void { this._selectedSignal.set(null); }

  setSignalTypeFilter(type: string | undefined): void { this._signalTypeFilter.set(type); }
  setSeverityFilter(severity: number | undefined): void { this._severityFilter.set(severity); }
  setStatusFilter(status: string | undefined): void { this._statusFilter.set(status); }
  clearFilters(): void {
    this._signalTypeFilter.set(undefined);
    this._severityFilter.set(undefined);
    this._statusFilter.set(undefined);
  }
}
