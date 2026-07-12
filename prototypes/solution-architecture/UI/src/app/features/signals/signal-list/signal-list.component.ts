import {
  Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SignalStore } from '../../../core/services/signal.store';
import { Signal as SignalModel } from '../../../core/models/signal.model';
import { SignalCreateComponent } from '../signal-create/signal-create.component';
import { SignalStatusUpdateComponent } from '../signal-status-update/signal-status-update.component';

@Component({
  selector: 'app-signal-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCardModule, MatProgressSpinnerModule, MatTooltipModule
  ],
  templateUrl: './signal-list.component.html',
  styleUrl: './signal-list.component.scss'
})
export class SignalListComponent implements OnInit, OnDestroy {
  private readonly store    = inject(SignalStore);
  private readonly dialog   = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router   = inject(Router);
  private refreshTimer?: ReturnType<typeof setInterval>;

  readonly signals  = this.store.filteredSignals;
  readonly loading  = this.store.loading;
  readonly error    = this.store.error;
  readonly critical = this.store.criticalSignals;

  readonly displayedColumns = [
    'severity', 'signalType', 'source', 'title', 'status', 'createdAt', 'actions'
  ];

  readonly typeFilter     = new FormControl<string | null>(null);
  readonly severityFilter = new FormControl<number | null>(null);
  readonly statusFilter   = new FormControl<string | null>(null);

  readonly signalTypes = ['BIOMETRIC', 'NETWORK', 'CREDIT', 'OTP', 'KYC', 'AUTH', 'SYSTEM'];
  readonly statuses    = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  readonly severities  = [
    { value: 4, label: 'Critical' },
    { value: 3, label: 'Error' },
    { value: 2, label: 'Warning' },
    { value: 1, label: 'Info' }
  ];

  ngOnInit(): void {
    this.store.loadSignals();
    this.refreshTimer = setInterval(() => this.store.loadSignals(), 30_000);

    this.typeFilter.valueChanges.subscribe(v =>
      this.store.setSignalTypeFilter(v ?? undefined));
    this.severityFilter.valueChanges.subscribe(v =>
      this.store.setSeverityFilter(v ?? undefined));
    this.statusFilter.valueChanges.subscribe(v =>
      this.store.setStatusFilter(v ?? undefined));
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
    this.store.clearFilters();
  }

  viewSignal(row: SignalModel): void {
    this.router.navigate(['/signals', row.signalId]);
  }

  openCreate(): void {
    const ref = this.dialog.open(SignalCreateComponent, {
      width: '620px', disableClose: true
    });
    ref.afterClosed().subscribe(created => {
      if (created) {
        this.store.loadSignals();
        this.snackBar.open('Signal created', 'OK', { duration: 3000 });
      }
    });
  }

  openStatusUpdate(row: SignalModel, event: Event): void {
    event.stopPropagation();
    const ref = this.dialog.open(SignalStatusUpdateComponent, {
      width: '420px',
      data: { signalId: row.signalId, currentStatus: row.status }
    });
    ref.afterClosed().subscribe(updated => {
      if (updated) {
        this.store.loadSignals();
        this.snackBar.open('Status updated', 'OK', { duration: 3000 });
      }
    });
  }

  refresh(): void { this.store.loadSignals(); }

  clearFilters(): void {
    this.typeFilter.reset();
    this.severityFilter.reset();
    this.statusFilter.reset();
    this.store.clearFilters();
  }

  severityColor(s: number): string {
    return ({ 4: '#ef4444', 3: '#f59e0b', 2: '#eab308', 1: '#3b82f6' } as Record<number,string>)[s] ?? '#6b7280';
  }

  severityLabel(s: number): string {
    return ({ 4: 'CRITICAL', 3: 'ERROR', 2: 'WARNING', 1: 'INFO' } as Record<number,string>)[s] ?? '?';
  }

  statusColor(status: string): string {
    return ({
      OPEN: '#6b7280', IN_PROGRESS: '#3b82f6', RESOLVED: '#10b981', CLOSED: '#4b5563'
    } as Record<string,string>)[status] ?? '#6b7280';
  }
}
