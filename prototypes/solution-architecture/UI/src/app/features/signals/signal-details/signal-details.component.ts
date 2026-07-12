import {
  Component, OnInit, inject, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SignalStore } from '../../../core/services/signal.store';
import { SignalService } from '../../../core/services/signal.service';
import { SignalCommentsComponent } from '../signal-comments/signal-comments.component';
import { SignalStatusUpdateComponent } from '../signal-status-update/signal-status-update.component';

@Component({
  selector: 'app-signal-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatDividerModule, MatProgressSpinnerModule,
    MatTooltipModule,
    SignalCommentsComponent
  ],
  templateUrl: './signal-details.component.html',
  styleUrl: './signal-details.component.scss'
})
export class SignalDetailsComponent implements OnInit {
  private readonly route     = inject(ActivatedRoute);
  private readonly router    = inject(Router);
  private readonly store     = inject(SignalStore);
  private readonly signalSvc = inject(SignalService);
  private readonly dialog    = inject(MatDialog);
  private readonly snackBar  = inject(MatSnackBar);

  readonly signal  = this.store.selectedSignal;
  readonly loading = this.store.loading;
  readonly error   = this.store.error;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.store.loadSignalDetails(id);
  }

  goBack(): void { this.router.navigate(['/signals']); }

  openStatusUpdate(): void {
    const s = this.signal();
    if (!s) return;

    const ref = this.dialog.open(SignalStatusUpdateComponent, {
      width: '420px',
      data: { signalId: s.signalId, currentStatus: s.status }
    });
    ref.afterClosed().subscribe(updated => {
      if (updated) this.store.loadSignalDetails(s.signalId);
    });
  }

  classify(): void {
    const s = this.signal();
    if (!s) return;

    this.signalSvc.classifySignal(s.signalId).subscribe({
      next: () => {
        this.snackBar.open('ML classification triggered', 'OK', { duration: 3000 });
        this.store.loadSignalDetails(s.signalId);
      },
      error: () => this.snackBar.open('Classification failed', 'Dismiss', { duration: 4000 })
    });
  }

  formatJson(json: string | undefined): string {
    if (!json) return '';
    try { return JSON.stringify(JSON.parse(json), null, 2); }
    catch { return json; }
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
