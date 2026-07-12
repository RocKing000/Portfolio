import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminService } from '../services/admin.service';
import { TenantListItem } from '../models/admin.models';

@Component({
  selector: 'app-tenant-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit Tenant' : 'New Tenant' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="tenant-form">
        @if (!isEdit) {
          <mat-form-field appearance="outline">
            <mat-label>Tenant Code</mat-label>
            <input matInput formControlName="tenantCode" placeholder="e.g. CLIENT_A" />
          </mat-form-field>
        }
        <mat-form-field appearance="outline">
          <mat-label>Tenant Name</mat-label>
          <input matInput formControlName="tenantName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Contact Email</mat-label>
          <input matInput type="email" formControlName="contactEmail" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="2"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || saving" (click)="save()">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`.tenant-form { display: flex; flex-direction: column; gap: 0.5rem; min-width: 400px; padding-top: 0.5rem; }`]
})
export class TenantDialogComponent {
  private readonly fb           = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly snack        = inject(MatSnackBar);
  private readonly dialogRef    = inject(MatDialogRef<TenantDialogComponent>);
  readonly data: TenantListItem | null = inject(MAT_DIALOG_DATA);

  isEdit = !!this.data;
  saving = false;

  form = this.fb.group({
    tenantCode:   [this.data?.tenantCode   ?? '', this.isEdit ? [] : [Validators.required]],
    tenantName:   [this.data?.tenantName   ?? '', Validators.required],
    contactEmail: [this.data?.contactEmail ?? ''],
    description:  [this.data?.description  ?? ''],
  });

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.getRawValue();

    const obs = this.isEdit
      ? this.adminService.updateTenant(this.data!.tenantId, v.tenantName!, v.description ?? undefined)
      : this.adminService.createTenant({
          tenantCode:   v.tenantCode!,
          tenantName:   v.tenantName!,
          contactEmail: v.contactEmail ?? undefined,
          description:  v.description  ?? undefined,
        });

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
