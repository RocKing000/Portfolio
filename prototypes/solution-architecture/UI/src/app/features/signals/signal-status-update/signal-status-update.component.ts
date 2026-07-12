import {
  Component, Inject, inject, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SignalService } from '../../../core/services/signal.service';

export interface StatusUpdateDialogData {
  signalId: string;
  currentStatus: string;
}

@Component({
  selector: 'app-signal-status-update',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './signal-status-update.component.html'
})
export class SignalStatusUpdateComponent {
  private readonly fb        = inject(FormBuilder);
  private readonly signalSvc = inject(SignalService);
  private readonly dialogRef = inject(MatDialogRef<SignalStatusUpdateComponent>);
  private readonly snackBar  = inject(MatSnackBar);
  readonly data = inject<StatusUpdateDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);

  readonly validTransitions: Record<string, string[]> = {
    OPEN:        ['IN_PROGRESS'],
    IN_PROGRESS: ['RESOLVED'],
    RESOLVED:    ['CLOSED', 'OPEN'],
    CLOSED:      []
  };

  get allowedStatuses(): string[] {
    return this.validTransitions[this.data.currentStatus] ?? [];
  }

  readonly form = this.fb.nonNullable.group({
    status:          [this.allowedStatuses[0] ?? '', Validators.required],
    resolutionNotes: ['']
  });

  readonly statusLabels: Record<string, string | undefined> = {
    OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', CLOSED: 'Closed'
  };

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.saving.set(true);
    const v = this.form.getRawValue();

    this.signalSvc.updateStatus(this.data.signalId, {
      status: v.status,
      resolutionNotes: v.resolutionNotes || undefined
    }).subscribe({
      next:  result => { this.saving.set(false); this.dialogRef.close(result); },
      error: err    => {
        this.saving.set(false);
        this.snackBar.open(err?.message ?? 'Failed to update status', 'Dismiss', { duration: 4000 });
      }
    });
  }

  cancel(): void { this.dialogRef.close(null); }
}
