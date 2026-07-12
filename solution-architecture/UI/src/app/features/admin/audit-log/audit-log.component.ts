import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminService } from '../services/admin.service';
import { AuditLogEntry } from '../models/admin.models';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatChipsModule, MatTooltipModule, MatSnackBarModule
  ],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss'
})
export class AuditLogComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly snack        = inject(MatSnackBar);

  logs: AuditLogEntry[] = [];
  displayedColumns = ['performedAt', 'performedBy', 'tableName', 'action', 'details'];
  loading = false;
  pageSize = 100;
  page = 1;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminService.getAuditLogs(this.pageSize, this.page).subscribe({
      next: data => { this.logs = data; this.loading = false; },
      error: () => { this.snack.open('Failed to load audit logs', 'Dismiss', { duration: 3000 }); this.loading = false; }
    });
  }

  getActionClass(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'action-create', UPDATE: 'action-update',
      DELETE: 'action-delete', PASSWORD_RESET: 'action-reset'
    };
    return map[action] ?? '';
  }
}
