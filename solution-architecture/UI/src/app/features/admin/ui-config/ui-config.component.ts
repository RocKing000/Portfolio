import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService } from '../services/admin.service';
import { UiConfigItem } from '../models/admin.models';

@Component({
  selector: 'app-ui-config',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule,
    MatProgressSpinnerModule, MatTooltipModule
  ],
  templateUrl: './ui-config.component.html',
  styleUrl: './ui-config.component.scss'
})
export class UiConfigComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly snack        = inject(MatSnackBar);

  configs: UiConfigItem[] = [];
  editingId: number | null = null;
  editCtrl = new FormControl('');
  displayedColumns = ['section', 'configKey', 'configValue', 'componentType', 'actions'];
  loading = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.adminService.getUiConfigs().subscribe({
      next: data => { this.configs = data; this.loading = false; },
      error: () => { this.snack.open('Failed to load', 'Dismiss', { duration: 3000 }); this.loading = false; }
    });
  }

  startEdit(item: UiConfigItem): void {
    this.editingId = item.configId;
    this.editCtrl.setValue(item.configValue);
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editCtrl.setValue('');
  }

  saveEdit(item: UiConfigItem): void {
    const value = this.editCtrl.value ?? '';
    this.adminService.updateUiConfig(item.configId, value).subscribe({
      next: ok => {
        if (ok) {
          item.configValue = value;
          this.snack.open('Saved', '', { duration: 2000 });
          this.editingId = null;
        } else {
          this.snack.open('Update failed', 'Dismiss', { duration: 3000 });
        }
      },
      error: () => this.snack.open('Error updating config', 'Dismiss', { duration: 3000 })
    });
  }
}
