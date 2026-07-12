import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
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
import { RouterModule } from '@angular/router';
import { AdminService } from '../services/admin.service';
import { AppConfigItem } from '../models/admin.models';
import { AppConfigDialogComponent } from './app-config-dialog.component';

@Component({
  selector: 'app-app-config',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatTableModule, MatButtonModule, MatIconModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule,
    MatSnackBarModule, MatProgressSpinnerModule, MatChipsModule, MatTooltipModule
  ],
  templateUrl: './app-config.component.html',
  styleUrl: './app-config.component.scss'
})
export class AppConfigComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly dialog       = inject(MatDialog);
  private readonly snack        = inject(MatSnackBar);

  configs: AppConfigItem[] = [];
  displayedColumns = ['category', 'configKey', 'configValue', 'dataType', 'isActive', 'actions'];
  loading = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.adminService.getAppConfigs().subscribe({
      next: data => { this.configs = data; this.loading = false; },
      error: () => { this.snack.open('Failed to load configs', 'Dismiss', { duration: 3000 }); this.loading = false; }
    });
  }

  openCreate(): void {
    const ref = this.dialog.open(AppConfigDialogComponent, { width: '520px', data: null });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  openEdit(item: AppConfigItem): void {
    const ref = this.dialog.open(AppConfigDialogComponent, { width: '520px', data: item });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  delete(item: AppConfigItem): void {
    if (!confirm(`Delete "${item.configKey}"?`)) return;
    this.adminService.deleteAppConfig(item.configId).subscribe({
      next: ok => {
        if (ok) { this.snack.open('Deleted', '', { duration: 2000 }); this.load(); }
        else this.snack.open('Delete failed', 'Dismiss', { duration: 3000 });
      },
      error: () => this.snack.open('Delete failed', 'Dismiss', { duration: 3000 })
    });
  }
}
