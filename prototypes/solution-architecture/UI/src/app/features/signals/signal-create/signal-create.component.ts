import {
  Component, inject, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SignalService } from '../../../core/services/signal.service';

@Component({
  selector: 'app-signal-create',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatRadioModule, MatProgressSpinnerModule
  ],
  templateUrl: './signal-create.component.html'
})
export class SignalCreateComponent {
  private readonly fb        = inject(FormBuilder);
  private readonly signalSvc = inject(SignalService);
  private readonly dialogRef = inject(MatDialogRef<SignalCreateComponent>);
  private readonly snackBar  = inject(MatSnackBar);

  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    signalType:  ['', Validators.required],
    source:      ['', Validators.required],
    severity:    [3 as 1|2|3|4, Validators.required],
    priority:    ['MEDIUM', Validators.required],
    title:       ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    payload:     ['{}', this.jsonValidator]
  });

  readonly signalTypes = ['BIOMETRIC', 'NETWORK', 'CREDIT', 'OTP', 'KYC', 'AUTH', 'SYSTEM'];
  readonly sources     = ['WEB', 'MOBILE', 'API', 'BATCH', 'INTERNAL'];
  readonly priorities  = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  readonly severities  = [
    { value: 4, label: 'Critical' },
    { value: 3, label: 'Error' },
    { value: 2, label: 'Warning' },
    { value: 1, label: 'Info' }
  ];

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.saving.set(true);
    const v = this.form.getRawValue();

    this.signalSvc.createSignal({
      signalType:  v.signalType,
      source:      v.source,
      severity:    v.severity,
      priority:    v.priority,
      title:       v.title,
      description: v.description || undefined,
      payload:     v.payload || undefined
    }).subscribe({
      next:  created => { this.saving.set(false); this.dialogRef.close(created); },
      error: err     => {
        this.saving.set(false);
        this.snackBar.open(err?.message ?? 'Failed to create signal', 'Dismiss', { duration: 4000 });
      }
    });
  }

  cancel(): void { this.dialogRef.close(null); }

  private jsonValidator(ctrl: { value: string }) {
    if (!ctrl.value) return null;
    try { JSON.parse(ctrl.value); return null; }
    catch { return { invalidJson: true }; }
  }
}
