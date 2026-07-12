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
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService } from '../services/admin.service';
import { TenantListItem } from '../models/admin.models';
import { TenantDialogComponent } from './tenant-dialog.component';

@Component({
  selector: 'app-tenant-management',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatTableModule, MatButtonModule, MatIconModule, MatDialogModule,
    MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule
  ],
  templateUrl: './tenant-management.component.html',
  styleUrl: './tenant-management.component.scss'
})
export class TenantManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly dialog       = inject(MatDialog);
  private readonly snack        = inject(MatSnackBar);

  tenants: TenantListItem[] = [];
  displayedColumns = ['tenantCode', 'tenantName', 'contactEmail', 'isActive', 'createdAt', 'actions'];
  loading = false;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminService.getTenants().subscribe({
      next: data => { this.tenants = data; this.loading = false; },
      error: () => { this.snack.open('Failed to load', 'Dismiss', { duration: 3000 }); this.loading = false; }
    });
  }

  openCreate(): void {
    const ref = this.dialog.open(TenantDialogComponent, { width: '480px', data: null });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  openEdit(tenant: TenantListItem): void {
    const ref = this.dialog.open(TenantDialogComponent, { width: '480px', data: tenant });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }
}
