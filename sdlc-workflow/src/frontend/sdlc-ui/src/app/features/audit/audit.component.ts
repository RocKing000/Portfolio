import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  sessionId: string;
  component: number;
  eventType: string;
  details: string;
  outcome: 'success' | 'failure' | 'pending';
}

@Component({
  selector: 'sdlc-audit',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule,
  ],
  template: `
    <div class="audit-page">
      <h1>Audit Log</h1>

      <!-- Filters -->
      <mat-card class="filter-card">
        <mat-card-content>
          <form [formGroup]="filterForm" class="filter-row">
            <mat-form-field appearance="outline">
              <mat-label>Component</mat-label>
              <mat-select formControlName="component">
                <mat-option [value]="null">All</mat-option>
                <mat-option [value]="1">Component 1</mat-option>
                <mat-option [value]="2">Component 2</mat-option>
                <mat-option [value]="3">Component 3</mat-option>
                <mat-option [value]="4">Component 4</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Event Type</mat-label>
              <mat-select formControlName="eventType">
                <mat-option value="">All</mat-option>
                <mat-option value="GateDecision">Gate Decision</mat-option>
                <mat-option value="SessionStarted">Session Started</mat-option>
                <mat-option value="SessionCompleted">Session Completed</mat-option>
                <mat-option value="SafeMode">Safe Mode</mat-option>
                <mat-option value="AgentError">Agent Error</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Actor</mat-label>
              <input matInput formControlName="actor" placeholder="Username or agent name" />
            </mat-form-field>

            <button mat-raised-button color="primary" (click)="loadAudit()">
              <mat-icon>search</mat-icon> Search
            </button>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Audit table -->
      <mat-card>
        <mat-card-content>
          <table mat-table [dataSource]="(entries$ | async) ?? []" class="audit-table">

            <ng-container matColumnDef="timestamp">
              <th mat-header-cell *matHeaderCellDef>Timestamp</th>
              <td mat-cell *matCellDef="let e">{{ e.timestamp | date:'short' }}</td>
            </ng-container>

            <ng-container matColumnDef="actor">
              <th mat-header-cell *matHeaderCellDef>Actor</th>
              <td mat-cell *matCellDef="let e">{{ e.actor }}</td>
            </ng-container>

            <ng-container matColumnDef="component">
              <th mat-header-cell *matHeaderCellDef>Comp.</th>
              <td mat-cell *matCellDef="let e">C{{ e.component }}</td>
            </ng-container>

            <ng-container matColumnDef="eventType">
              <th mat-header-cell *matHeaderCellDef>Event</th>
              <td mat-cell *matCellDef="let e">
                <span [class]="eventClass(e.eventType)">{{ e.eventType }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="details">
              <th mat-header-cell *matHeaderCellDef>Details</th>
              <td mat-cell *matCellDef="let e" class="details-cell">{{ e.details }}</td>
            </ng-container>

            <ng-container matColumnDef="outcome">
              <th mat-header-cell *matHeaderCellDef>Outcome</th>
              <td mat-cell *matCellDef="let e">
                <mat-icon [class]="'outcome-' + e.outcome">
                  {{ e.outcome === 'success' ? 'check_circle' :
                     e.outcome === 'failure' ? 'error' : 'pending' }}
                </mat-icon>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell no-data" [attr.colspan]="columns.length">No audit entries found.</td>
            </tr>
          </table>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    h1 { margin-bottom: 1.5rem; }
    .filter-card   { margin-bottom: 1.5rem; }
    .filter-row    { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
    .filter-row mat-form-field { flex: 1; min-width: 160px; }
    .audit-table   { width: 100%; }
    .details-cell  { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .no-data       { text-align: center; padding: 2rem; color: #9e9e9e; }

    .event-gate     { background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 8px; font-size: 0.75rem; }
    .event-started  { background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 8px; font-size: 0.75rem; }
    .event-completed{ background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 8px; font-size: 0.75rem; }
    .event-safe     { background: #fce4ec; color: #880e4f; padding: 2px 8px; border-radius: 8px; font-size: 0.75rem; }
    .event-error    { background: #ffebee; color: #c62828; padding: 2px 8px; border-radius: 8px; font-size: 0.75rem; }
    .event-default  { background: #f5f5f5; color: #555;    padding: 2px 8px; border-radius: 8px; font-size: 0.75rem; }

    .outcome-success { color: #2e7d32; font-size: 1.2rem; }
    .outcome-failure { color: #c62828; font-size: 1.2rem; }
    .outcome-pending { color: #e65100; font-size: 1.2rem; }
  `],
})
export class AuditComponent implements OnInit {
  columns = ['timestamp', 'actor', 'component', 'eventType', 'details', 'outcome'];
  entries$!: Observable<AuditEntry[]>;
  filterForm: FormGroup;

  constructor(private api: ApiService, private fb: FormBuilder) {
    this.filterForm = this.fb.group({
      component: [null],
      eventType: [''],
      actor: [''],
    });
  }

  ngOnInit() {
    this.loadAudit();
  }

  loadAudit() {
    const { component, eventType, actor } = this.filterForm.value;
    const params: Record<string, string> = {};
    if (component) params['component'] = component;
    if (eventType) params['eventType'] = eventType;
    if (actor)     params['actor'] = actor;

    this.entries$ = this.api.get<AuditEntry[]>('/audit', params).pipe(
      catchError(() => of([])),
    );
  }

  eventClass(eventType: string): string {
    const m: Record<string, string> = {
      GateDecision:     'event-gate',
      SessionStarted:   'event-started',
      SessionCompleted: 'event-completed',
      SafeMode:         'event-safe',
      AgentError:       'event-error',
    };
    return m[eventType] ?? 'event-default';
  }
}
