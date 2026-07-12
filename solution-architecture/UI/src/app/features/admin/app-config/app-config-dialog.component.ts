import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminService } from '../services/admin.service';
import { AppConfigItem } from '../models/admin.models';

@Component({
  selector: 'app-config-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatButtonModule, MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit' : 'New' }} App Configuration</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="config-form">
        @if (!isEdit) {
          <mat-form-field appearance="outline">
            <mat-label>Config Key</mat-label>
            <input matInput formControlName="configKey" placeholder="e.g. jwt.secret" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Category</mat-label>
            <mat-select formControlName="category">
              @for (cat of categories; track cat) {
                <mat-option [value]="cat">{{ cat }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Data Type</mat-label>
            <mat-select formControlName="dataType">
              @for (t of dataTypes; track t) {
                <mat-option [value]="t">{{ t }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        <mat-form-field appearance="outline">
          <mat-label>Value</mat-label>
          <input matInput formControlName="configValue" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="2"></textarea>
        </mat-form-field>
        @if (isEdit) {
          <mat-checkbox formControlName="isActive">Active</mat-checkbox>
        } @else {
          <mat-checkbox formControlName="isEncrypted">Encrypted</mat-checkbox>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || saving" (click)="save()">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`.config-form { display: flex; flex-direction: column; gap: 0.5rem; min-width: 420px; padding-top: 0.5rem; }`]
})
export class AppConfigDialogComponent implements OnInit {
  private readonly fb           = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly snack        = inject(MatSnackBar);
  private readonly dialogRef    = inject(MatDialogRef<AppConfigDialogComponent>);
  readonly data: AppConfigItem | null = inject(MAT_DIALOG_DATA);

  isEdit = !!this.data;
  saving = false;

  categories = ['jwt', 'cors', 'server', 'database', 'ai', 'email', 'general'];
  dataTypes  = ['string', 'number', 'boolean', 'json'];

  form = this.fb.group({
    configKey:   [this.data?.configKey   ?? '', Validators.required],
    configValue: [this.data?.configValue ?? '', Validators.required],
    description: [this.data?.description ?? ''],
    category:    [this.data?.category    ?? 'general', Validators.required],
    dataType:    [this.data?.dataType    ?? 'string',  Validators.required],
    isEncrypted: [false],
    isActive:    [this.data?.isActive ?? true],
  });

  ngOnInit(): void {}

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    // getRawValue() uses null for empty fields; convert to undefined for Partial<AppConfigItem> compat
    const value = Object.fromEntries(
      Object.entries(this.form.getRawValue()).map(([k, v]) => [k, v ?? undefined])
    ) as Partial<AppConfigItem>;

    const obs = this.isEdit
      ? this.adminService.updateAppConfig({ configId: this.data!.configId, ...value })
      : this.adminService.createAppConfig(value);

    obs.subscribe({
      next: ok => {
        this.saving = false;
        if (ok) { this.snack.open('Saved', '', { duration: 2000 }); this.dialogRef.close(true); }
        else this.snack.open('Operation failed', 'Dismiss', { duration: 3000 });
      },
      error: () => { this.saving = false; this.snack.open('Error saving config', 'Dismiss', { duration: 3000 }); }
    });
  }
}
