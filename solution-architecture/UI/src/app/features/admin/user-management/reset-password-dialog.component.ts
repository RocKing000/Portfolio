import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-reset-password-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule,
    MatButtonModule, MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>Reset Password — {{ data.username }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="pwd-form">
        <mat-form-field appearance="outline">
          <mat-label>New Password</mat-label>
          <input matInput type="password" formControlName="newPassword" />
          @if (form.get('newPassword')?.hasError('minlength')) {
            <mat-error>Minimum 8 characters</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Confirm Password</mat-label>
          <input matInput type="password" formControlName="confirm" />
          @if (form.hasError('mismatch')) {
            <mat-error>Passwords do not match</mat-error>
          }
        </mat-form-field>
        <mat-checkbox formControlName="requirePasswordChange">Require change on next login</mat-checkbox>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="warn" [disabled]="form.invalid || saving" (click)="save()">
        {{ saving ? 'Resetting…' : 'Reset Password' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`.pwd-form { display: flex; flex-direction: column; gap: 0.5rem; min-width: 360px; padding-top: 0.5rem; }`]
})
export class ResetPasswordDialogComponent {
  private readonly fb           = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly snack        = inject(MatSnackBar);
  private readonly dialogRef    = inject(MatDialogRef<ResetPasswordDialogComponent>);
  readonly data: { userId: string; username: string } = inject(MAT_DIALOG_DATA);

  saving = false;

  form = this.fb.group(
    {
      newPassword:            ['', [Validators.required, Validators.minLength(8)]],
      confirm:                ['', Validators.required],
      requirePasswordChange:  [true]
    },
    { validators: (g: AbstractControl): ValidationErrors | null => {
        const p = g.get('newPassword')?.value;
        const c = g.get('confirm')?.value;
        return p && c && p !== c ? { mismatch: true } : null;
      }
    }
  );

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.getRawValue();
    this.adminService.resetPassword({
      userId: this.data.userId,
      newPassword: v.newPassword!,
      requirePasswordChange: v.requirePasswordChange!
    }).subscribe({
      next: ok => {
        this.saving = false;
        if (ok) { this.snack.open('Password reset', '', { duration: 2000 }); this.dialogRef.close(true); }
        else this.snack.open('Reset failed', 'Dismiss', { duration: 3000 });
      },
      error: () => { this.saving = false; this.snack.open('Error', 'Dismiss', { duration: 3000 }); }
    });
  }
}
