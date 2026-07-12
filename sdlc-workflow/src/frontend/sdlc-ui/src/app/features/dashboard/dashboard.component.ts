import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';

import { AppState } from '../../store/reducers';
import { Session } from '../../core/services/session.service';
import { selectActiveSessions, selectSafeModeSessions, selectCompletedSessions } from '../../store/selectors/session.selectors';
import * as SessionActions from '../../store/actions/session.actions';

@Component({
  selector: 'sdlc-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule,
  ],
  template: `
    <div class="dashboard">
      <h1>Dashboard</h1>

      <!-- Summary cards -->
      <div class="summary-grid">
        <mat-card>
          <mat-card-content>
            <div class="metric">
              <mat-icon>pending_actions</mat-icon>
              <div>
                <div class="metric-value">{{(activeSessions$ | async)?.length ?? 0}}</div>
                <div class="metric-label">Active Sessions</div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-content>
            <div class="metric">
              <mat-icon color="warn">warning</mat-icon>
              <div>
                <div class="metric-value">{{(safeModeSessions$ | async)?.length ?? 0}}</div>
                <div class="metric-label">Safe Mode</div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-content>
            <div class="metric">
              <mat-icon color="primary">check_circle</mat-icon>
              <div>
                <div class="metric-value">{{(completedSessions$ | async)?.length ?? 0}}</div>
                <div class="metric-label">Completed</div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Active sessions list -->
      <h2>Active Sessions</h2>
      <div class="sessions-grid" *ngIf="activeSessions$ | async as sessions">
        <mat-card *ngFor="let session of sessions" class="session-card"
                  [routerLink]="['/sessions', session.id]">
          <mat-card-header>
            <mat-card-title>Component {{session.component}}</mat-card-title>
            <mat-card-subtitle>{{session.id | slice:0:8}}…</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <span [class]="statusChipClass(session.status)">{{session.status}}</span>
            <p class="current-agent">
              <mat-icon>smart_toy</mat-icon>
              {{session.currentAgent || 'Starting…'}}
            </p>
            <p *ngIf="session.pendingGate" class="gate-pending">
              <mat-icon color="warn">hourglass_top</mat-icon>
              Awaiting {{session.pendingGate}} approval
            </p>
          </mat-card-content>
          <mat-card-actions>
            <button mat-button color="primary" [routerLink]="['/sessions', session.id]">
              View
            </button>
          </mat-card-actions>
        </mat-card>

        <div *ngIf="sessions.length === 0" class="empty-state">
          <mat-icon>inbox</mat-icon>
          <p>No active sessions. Start a new project session to begin.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    h1, h2 { margin-bottom: 1rem; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .metric { display: flex; align-items: center; gap: 1rem; }
    .metric mat-icon { font-size: 2.5rem; height: 2.5rem; width: 2.5rem; color: #3949ab; }
    .metric-value { font-size: 2rem; font-weight: 700; line-height: 1; }
    .metric-label { color: #666; font-size: 0.875rem; }
    .sessions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
    .session-card { cursor: pointer; transition: box-shadow 0.2s; }
    .session-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
    .current-agent { display: flex; align-items: center; gap: 4px; color: #555; font-size: 0.875rem; margin: 0.5rem 0 0; }
    .gate-pending  { display: flex; align-items: center; gap: 4px; color: #e65100; font-size: 0.875rem; margin: 0.25rem 0 0; }
    .empty-state { display: flex; flex-direction: column; align-items: center;
                   padding: 3rem; color: #9e9e9e; grid-column: 1/-1; }
    .empty-state mat-icon { font-size: 3rem; height: 3rem; width: 3rem; }
  `],
})
export class DashboardComponent implements OnInit {
  activeSessions$:   Observable<Session[]>;
  safeModeSessions$: Observable<Session[]>;
  completedSessions$: Observable<Session[]>;

  constructor(private store: Store<AppState>) {
    this.activeSessions$    = this.store.select(selectActiveSessions);
    this.safeModeSessions$  = this.store.select(selectSafeModeSessions);
    this.completedSessions$ = this.store.select(selectCompletedSessions);
  }

  ngOnInit() {
    this.store.dispatch(SessionActions.loadSessions({}));
  }

  statusChipClass(status: string): string {
    const map: Record<string, string> = {
      'Active':    'chip-active',
      'Paused':    'chip-paused',
      'Completed': 'chip-complete',
      'SafeMode':  'chip-safe',
    };
    return map[status] ?? '';
  }
}
