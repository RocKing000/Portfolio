import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService } from '../services/admin.service';
import { UserListItem, RoleListItem, TenantListItem } from '../models/admin.models';
import { UserDialogComponent } from './user-dialog.component';
import { ResetPasswordDialogComponent } from './reset-password-dialog.component';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatTableModule, MatButtonModule, MatIconModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule,
    MatSnackBarModule, MatProgressSpinnerModule, MatChipsModule, MatTooltipModule
  ],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly dialog       = inject(MatDialog);
  private readonly snack        = inject(MatSnackBar);

  users: UserListItem[]     = [];
  roles: RoleListItem[]     = [];
  tenants: TenantListItem[] = [];
  displayedColumns = ['username', 'fullName', 'email', 'roleName', 'tenantName', 'isActive', 'actions'];
  loading = false;

  ngOnInit(): void {
    this.loadRolesAndTenants();
    this.load();
  }

  private loadRolesAndTenants(): void {
    this.adminService.getRoles().subscribe(r => this.roles = r);
    this.adminService.getTenants().subscribe(t => this.tenants = t);
  }

  load(): void {
    this.loading = true;
    this.adminService.getUsers().subscribe({
      next: data => { this.users = data; this.loading = false; },
      error: () => { this.snack.open('Failed to load users', 'Dismiss', { duration: 3000 }); this.loading = false; }
    });
  }

  openCreate(): void {
    const ref = this.dialog.open(UserDialogComponent, {
      width: '560px',
      data: { user: null, roles: this.roles, tenants: this.tenants }
    });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  openEdit(user: UserListItem): void {
    const ref = this.dialog.open(UserDialogComponent, {
      width: '560px',
      data: { user, roles: this.roles, tenants: this.tenants }
    });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  openResetPassword(user: UserListItem): void {
    const ref = this.dialog.open(ResetPasswordDialogComponent, {
      width: '420px',
      data: { userId: user.userId, username: user.username }
    });
    ref.afterClosed().subscribe(() => {});
  }

  delete(user: UserListItem): void {
    if (!confirm(`Deactivate user "${user.username}"?`)) return;
    this.adminService.deleteUser(user.userId).subscribe({
      next: ok => {
        if (ok) { this.snack.open('User deactivated', '', { duration: 2000 }); this.load(); }
        else this.snack.open('Delete failed', 'Dismiss', { duration: 3000 });
      },
      error: () => this.snack.open('Delete failed', 'Dismiss', { duration: 3000 })
    });
  }
}
