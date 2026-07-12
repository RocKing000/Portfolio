import {
  Component, Input, OnInit, OnDestroy, inject, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { SignalService } from '../../../core/services/signal.service';
import { Signal as SignalModel } from '../../../core/models/signal.model';
import { WidgetConfig } from '../../../core/models/widget.model';

@Component({
  selector: 'app-table-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatTableModule, MatProgressSpinnerModule, MatIconModule],
  template: `
    <div class="table-widget">
      <div *ngIf="loading()" class="tw-loading">
        <mat-spinner diameter="32"></mat-spinner>
      </div>
      <div *ngIf="error() && !loading()" class="tw-error">
        <mat-icon>error</mat-icon> {{ error() }}
      </div>
      <table *ngIf="!loading() && rows().length > 0" mat-table [dataSource]="rows()" class="tw-table">
        <ng-container matColumnDef="severity">
          <th mat-header-cell *matHeaderCellDef>Sev</th>
          <td mat-cell *matCellDef="let r">
            <span class="sev-dot" [style.background]="sevColor(r.severity)"></span>
          </td>
        </ng-container>
        <ng-container matColumnDef="signalType">
          <th mat-header-cell *matHeaderCellDef>Type</th>
          <td mat-cell *matCellDef="let r">{{ r.signalType }}</td>
        </ng-container>
        <ng-container matColumnDef="source">
          <th mat-header-cell *matHeaderCellDef>Source</th>
          <td mat-cell *matCellDef="let r">{{ r.source }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let r">{{ r.status }}</td>
        </ng-container>
        <ng-container matColumnDef="createdAt">
          <th mat-header-cell *matHeaderCellDef>Created</th>
          <td mat-cell *matCellDef="let r">{{ r.createdAt | date:'shortDate' }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr mat-row *matRowDef="let r; columns: cols" class="tw-row" (click)="nav(r)"></tr>
      </table>
      <div *ngIf="!loading() && rows().length === 0" class="tw-empty">
        <mat-icon>check_circle_outline</mat-icon> No signals
      </div>
    </div>
  `,
  styles: [`
    .table-widget { height: 100%; overflow: auto; }
    .tw-loading, .tw-error, .tw-empty {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; padding: 24px; color: rgba(0,0,0,.54);
    }
    .tw-error { color: #ef4444; }
    .tw-table { width: 100%; font-size: 12px; }
    .tw-row { cursor: pointer; &:hover { background: rgba(0,0,0,.04); } }
    .sev-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
  `]
})
export class TableWidgetComponent implements OnInit, OnDestroy {
  @Input() config!: WidgetConfig;

  private readonly signalSvc = inject(SignalService);
  private readonly router    = inject(Router);
  private refreshTimer?: ReturnType<typeof setInterval>;

  readonly rows    = signal<SignalModel[]>([]);
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly cols    = ['severity', 'signalType', 'source', 'status', 'createdAt'];

  ngOnInit(): void {
    this.loadData();
    const interval = (this.config?.refreshInterval ?? 60) * 1000;
    this.refreshTimer = setInterval(() => this.loadData(), interval);
  }

  ngOnDestroy(): void { clearInterval(this.refreshTimer); }

  nav(row: SignalModel): void { this.router.navigate(['/signals', row.signalId]); }

  sevColor(s: number): string {
    return ({ 4: '#ef4444', 3: '#f59e0b', 2: '#eab308', 1: '#3b82f6' } as Record<number,string>)[s] ?? '#6b7280';
  }

  private loadData(): void {
    this.loading.set(true);
    const f = this.config?.filters;
    this.signalSvc.getOpenSignals(f?.limit ?? 20, f?.severity, f?.signalType).subscribe({
      next:  r => { this.rows.set(r.data ?? []); this.loading.set(false); },
      error: e => { this.error.set(e?.message ?? 'Load failed'); this.loading.set(false); }
    });
  }
}
