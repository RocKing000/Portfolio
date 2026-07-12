import { Component, inject } from '@angular/core';
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
import { UserListItem, RoleListItem, TenantListItem } from '../models/admin.models';

interface DialogData {
  user: UserListItem | null;
  roles: RoleListItem[];
  tenants: TenantListItem[];
}

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatButtonModule, MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit User' : 'New User' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="user-form">
        @if (!isEdit) {
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Username</mat-label>
              <input matInput formControlName="username" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput type="password" formControlName="password" />
            </mat-form-field>
          </div>
        }
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>First Name</mat-label>
            <input matInput formControlName="firstName" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Last Name</mat-label>
            <input matInput formControlName="lastName" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Mobile</mat-label>
          <input matInput formControlName="mobile" />
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Role</mat-label>
            <mat-select formControlName="roleId">
              @for (r of data.roles; track r.roleId) {
                <mat-option [value]="r.roleId">{{ r.roleName }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (!isEdit) {
            <mat-form-field appearance="outline">
              <mat-label>Tenant</mat-label>
              <mat-select formControlName="tenantId">
                @for (t of data.tenants; track t.tenantId) {
                  <mat-option [value]="t.tenantId">{{ t.tenantName }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
        </div>
        @if (isEdit) {
          <mat-checkbox formControlName="isActive">Active</mat-checkbox>
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
  styles: [`
    .user-form { display: flex; flex-direction: column; gap: 0.5rem; min-width: 460px; padding-top: 0.5rem; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  `]
})
export class UserDialogComponent {
  private readonly fb           = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly snack        = inject(MatSnackBar);
  private readonly dialogRef    = inject(MatDialogRef<UserDialogComponent>);
  readonly data: DialogData     = inject(MAT_DIALOG_DATA);

  isEdit = !!this.data.user;
  saving = false;

  form = this.fb.group({
    username:  [{ value: this.data.user?.username ?? '', disabled: this.isEdit }, Validators.required],
    password:  ['', this.isEdit ? [] : [Validators.required, Validators.minLength(8)]],
    firstName: [this.data.user?.firstName ?? '', Validators.required],
    lastName:  [this.data.user?.lastName  ?? '', Validators.required],
    email:     [this.data.user?.email     ?? '', [Validators.required, Validators.email]],
    mobile:    [this.data.user?.mobile    ?? ''],
    roleId:    [this.data.user?.roleId    ?? '', Validators.required],
    tenantId:  ['', this.isEdit ? [] : [Validators.required]],
    isActive:  [this.data.user?.isActive ?? true],
  });

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.getRawValue();

    const obs = this.isEdit
      ? this.adminService.updateUser({
          userId: this.data.user!.userId,
          firstName: v.firstName!, lastName: v.lastName!,
          email: v.email!, mobile: v.mobile ?? undefined,
          roleId: v.roleId!, isActive: v.isActive!
        })
      : this.adminService.createUser({
          username: v.username!, password: v.password!,
          firstName: v.firstName!, lastName: v.lastName!,
          email: v.email!, mobile: v.mobile ?? undefined,
          roleId: v.roleId!, tenantId: v.tenantId!
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
