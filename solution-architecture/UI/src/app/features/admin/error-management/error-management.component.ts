import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService } from '../services/admin.service';
import { ErrorListItem, TenantListItem } from '../models/admin.models';
import { ErrorDialogComponent } from './error-dialog.component';

@Component({
  selector: 'app-error-management',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatTableModule, MatButtonModule, MatIconModule, MatDialogModule,
    MatSnackBarModule, MatProgressSpinnerModule, MatChipsModule, MatTooltipModule
  ],
  templateUrl: './error-management.component.html',
  styleUrl: './error-management.component.scss'
})
export class ErrorManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly dialog       = inject(MatDialog);
  private readonly snack        = inject(MatSnackBar);

  errors: ErrorListItem[]   = [];
  tenants: TenantListItem[] = [];
  displayedColumns = ['errorCode', 'errorTitle', 'severity', 'category', 'tenantCode', 'actions'];
  loading = false;

  ngOnInit(): void {
    this.adminService.getTenants().subscribe(t => this.tenants = t);
    this.load();
  }

  load(): void {
    this.loading = true;
    this.adminService.getErrors().subscribe({
      next: data => { this.errors = data; this.loading = false; },
      error: () => { this.snack.open('Failed to load errors', 'Dismiss', { duration: 3000 }); this.loading = false; }
    });
  }

  openCreate(): void {
    const ref = this.dialog.open(ErrorDialogComponent, { width: '580px', data: { error: null, tenants: this.tenants } });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  openEdit(error: ErrorListItem): void {
    const ref = this.dialog.open(ErrorDialogComponent, { width: '580px', data: { error, tenants: this.tenants } });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  delete(error: ErrorListItem): void {
    if (!confirm(`Delete error "${error.errorCode}"?`)) return;
    this.adminService.deleteError(error.errorId).subscribe({
      next: ok => {
        if (ok) { this.snack.open('Deleted', '', { duration: 2000 }); this.load(); }
        else this.snack.open('Delete failed', 'Dismiss', { duration: 3000 });
      },
      error: () => this.snack.open('Delete failed', 'Dismiss', { duration: 3000 })
    });
  }
}
