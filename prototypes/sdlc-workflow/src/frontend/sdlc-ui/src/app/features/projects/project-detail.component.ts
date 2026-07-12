import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiService } from '../../core/services/api.service';
import { AppState } from '../../store/reducers';
import { selectAllSessions } from '../../store/reducers/session.reducer';
import { Session } from '../../core/services/session.service';
import * as SessionActions from '../../store/actions/session.actions';
import { Project } from './project-list.component';

@Component({
  selector: 'sdlc-project-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTabsModule,
    MatSelectModule, MatFormFieldModule,
  ],
  template: `
    <div class="project-detail" *ngIf="project$ | async as project; else loading">
      <div class="page-header">
        <div>
          <h1>{{ project.name }}</h1>
          <p class="description">{{ project.description }}</p>
        </div>
      </div>

      <mat-tab-group>
        <!-- Sessions tab -->
        <mat-tab label="Sessions">
          <div class="tab-content">
            <div class="tab-actions">
              <button mat-raised-button color="primary" (click)="showNewSession = !showNewSession">
                <mat-icon>add</mat-icon> New Session
              </button>
            </div>

            <!-- New session form -->
            <mat-card *ngIf="showNewSession" class="new-session-card">
              <mat-card-header><mat-card-title>Start New Session</mat-card-title></mat-card-header>
              <mat-card-content>
                <form [formGroup]="sessionForm" (ngSubmit)="startSession(project.id)">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Component</mat-label>
                    <mat-select formControlName="component">
                      <mat-option [value]="1">Component 1 — Requirements Engineering</mat-option>
                      <mat-option [value]="2">Component 2 — System Design</mat-option>
                      <mat-option [value]="3">Component 3 — Implementation</mat-option>
                      <mat-option [value]="4">Component 4 — Quality Assurance</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Operating Mode</mat-label>
                    <mat-select formControlName="operatingMode">
                      <mat-option value="Autonomous">Autonomous</mat-option>
                      <mat-option value="Supervised">Supervised</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <div class="form-actions">
                    <button mat-button type="button" (click)="showNewSession = false">Cancel</button>
                    <button mat-raised-button color="primary" type="submit"
                            [disabled]="!sessionForm.valid">Start</button>
                  </div>
                </form>
              </mat-card-content>
            </mat-card>

            <!-- Sessions list -->
            <div class="sessions-grid" *ngIf="sessions$ | async as sessions">
              <mat-card *ngFor="let s of sessions" class="session-card"
                        [routerLink]="['/sessions', s.id]">
                <mat-card-header>
                  <mat-card-title>Component {{ s.component }}</mat-card-title>
                  <mat-card-subtitle>{{ s.id | slice:0:8 }}…</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <span [class]="chipClass(s.status)">{{ s.status }}</span>
                  <p class="agent-line"><mat-icon>smart_toy</mat-icon> {{ s.currentAgent || 'Starting…' }}</p>
                </mat-card-content>
                <mat-card-actions>
                  <button mat-button color="primary">View</button>
                </mat-card-actions>
              </mat-card>
              <div *ngIf="sessions.length === 0" class="empty-state">
                <mat-icon>pending_actions</mat-icon>
                <p>No sessions yet. Start a session to begin the SDLC workflow.</p>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>

    <ng-template #loading><div class="empty-state"><p>Loading project…</p></div></ng-template>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
    .description  { color: #666; margin: 0.25rem 0 0; }
    .tab-content  { padding: 1rem 0; }
    .tab-actions  { margin-bottom: 1rem; }
    .new-session-card { margin-bottom: 1rem; max-width: 480px; }
    .full-width   { width: 100%; }
    .form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
    .sessions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .session-card  { cursor: pointer; transition: box-shadow 0.2s; }
    .session-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
    .agent-line    { display: flex; align-items: center; gap: 4px; color: #555; font-size: 0.875rem; margin: 0.5rem 0 0; }
    .empty-state   { display: flex; flex-direction: column; align-items: center; padding: 2rem; color: #9e9e9e; grid-column: 1/-1; }
    .empty-state mat-icon { font-size: 3rem; height: 3rem; width: 3rem; }
    .chip-active   { background: #e3f2fd; color: #1565c0; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .chip-paused   { background: #fff3e0; color: #e65100; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .chip-complete { background: #e8f5e9; color: #2e7d32; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .chip-safe     { background: #fce4ec; color: #880e4f; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
  `],
})
export class ProjectDetailComponent implements OnInit {
  project$!: Observable<Project>;
  sessions$!: Observable<Session[]>;
  showNewSession = false;
  sessionForm: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private store: Store<AppState>,
    private fb: FormBuilder,
  ) {
    this.sessionForm = this.fb.group({
      component: [1, Validators.required],
      operatingMode: ['Supervised', Validators.required],
    });
  }

  ngOnInit() {
    const projectId = this.route.snapshot.paramMap.get('projectId')!;
    this.project$ = this.api.get<Project>(`/projects/${projectId}`);
    this.store.dispatch(SessionActions.loadSessions({ projectId }));
    this.sessions$ = this.store.select(s => s.session).pipe(
      map(selectAllSessions),
      map(sessions => sessions.filter(s => s.projectId === projectId)),
    );
  }

  startSession(projectId: string) {
    if (!this.sessionForm.valid) return;
    const { component, operatingMode } = this.sessionForm.value;
    this.api.post<Session>('/sessions', { projectId, component, operatingMode }).subscribe(() => {
      this.showNewSession = false;
      this.store.dispatch(SessionActions.loadSessions({ projectId }));
    });
  }

  chipClass(status: string): string {
    const m: Record<string, string> = {
      Active: 'chip-active', Paused: 'chip-paused',
      Completed: 'chip-complete', SafeMode: 'chip-safe',
    };
    return m[status] ?? '';
  }
}
