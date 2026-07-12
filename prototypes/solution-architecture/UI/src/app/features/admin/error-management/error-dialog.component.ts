import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminService } from '../services/admin.service';
import { ErrorListItem, TenantListItem } from '../models/admin.models';

interface DialogData {
  error: ErrorListItem | null;
  tenants: TenantListItem[];
}

@Component({
  selector: 'app-error-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit Error' : 'New Error' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="error-form">
        <div class="row">
          @if (!isEdit) {
            <mat-form-field appearance="outline">
              <mat-label>Error Code</mat-label>
              <input matInput formControlName="errorCode" placeholder="e.g. ERR_001" />
            </mat-form-field>
          }
          <mat-form-field appearance="outline">
            <mat-label>Severity</mat-label>
            <mat-select formControlName="severity">
              @for (s of severities; track s) {
                <mat-option [value]="s">{{ s }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Error Title</mat-label>
          <input matInput formControlName="errorTitle" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="errorDescription" rows="3"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Solution</mat-label>
          <textarea matInput formControlName="solution" rows="3"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Root Cause</mat-label>
          <input matInput formControlName="rootCause" />
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Category</mat-label>
            <input matInput formControlName="category" />
          </mat-form-field>
          @if (!isEdit) {
            <mat-form-field appearance="outline">
              <mat-label>Tenant</mat-label>
              <mat-select formControlName="tenantCode">
                @for (t of data.tenants; track t.tenantId) {
                  <mat-option [value]="t.tenantCode">{{ t.tenantName }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || saving" (click)="save()">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .error-form { display: flex; flex-direction: column; gap: 0.5rem; min-width: 480px; padding-top: 0.5rem; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  `]
})
export class ErrorDialogComponent {
  private readonly fb           = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly snack        = inject(MatSnackBar);
  private readonly dialogRef    = inject(MatDialogRef<ErrorDialogComponent>);
  readonly data: DialogData     = inject(MAT_DIALOG_DATA);

  isEdit = !!this.data.error;
  saving = false;
  severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  form = this.fb.group({
    errorCode:        [this.data.error?.errorCode        ?? '', this.isEdit ? [] : [Validators.required]],
    errorTitle:       [this.data.error?.errorTitle       ?? '', Validators.required],
    errorDescription: [this.data.error?.errorDescription ?? '', Validators.required],
    solution:         [this.data.error?.solution         ?? '', Validators.required],
    rootCause:        [this.data.error?.rootCause        ?? ''],
    severity:         [this.data.error?.severity         ?? 'MEDIUM', Validators.required],
    category:         [this.data.error?.category         ?? '', Validators.required],
    tenantCode:       [this.data.error?.tenantCode       ?? '', this.isEdit ? [] : [Validators.required]],
  });

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.getRawValue();

    const payload = {
      errorCode:        v.errorCode!,
      errorTitle:       v.errorTitle!,
      errorDescription: v.errorDescription!,
      solution:         v.solution!,
      rootCause:        v.rootCause ?? undefined,
      severity:         v.severity as any,
      category:         v.category!,
      tenantCode:       v.tenantCode!,
    };

    const obs = this.isEdit
      ? this.adminService.updateError(this.data.error!.errorId, payload)
      : this.adminService.createError(payload);

    obs.subscribe({
      next: ok => {
        this.saving = false;
        if (ok) { this.snack.open('Saved', '', { duration: 2000 }); this.dialogRef.close(true); }
        else this.snack.open('Operation failed', 'Dismiss', { duration: 3000 });
      },
      error: () => { this.saving = false; this.snack.open('Error', 'Dismiss', { duration: 3000 }); }
    });
  }
}
