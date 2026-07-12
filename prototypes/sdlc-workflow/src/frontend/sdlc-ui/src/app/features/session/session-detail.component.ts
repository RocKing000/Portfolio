import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Store } from '@ngrx/store';
import { Observable, interval, Subscription } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';

import { AppState } from '../../store/reducers';
import { Session } from '../../core/services/session.service';
import { ApiService } from '../../core/services/api.service';
import { selectSessionEntities } from '../../store/reducers/session.reducer';
import * as SessionActions from '../../store/actions/session.actions';

interface AgentLogEntry {
  agentName: string;
  timestamp: string;
  status: 'running' | 'completed' | 'failed';
  outputSummary?: string;
}

interface SessionDetail extends Session {
  agentLog: AgentLogEntry[];
  planDocumentKey?: string;
}

const GATE_LABELS: Record<string, string> = {
  gate1: 'Gate 1 — Research & Requirements Review',
  gate2: 'Gate 2 — Architecture & Design Review',
  gate3: 'Gate 3 — Final Deliverable Review',
  gate4: 'Gate 4 — Implementation Approval',
};

const COMPONENT_GATES: Record<number, string[]> = {
  1: ['gate1', 'gate2', 'gate3'],
  2: ['gate1', 'gate2', 'gate3'],
  3: ['gate1', 'gate2'],
  4: ['gate1'],
};

@Component({
  selector: 'sdlc-session-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatStepperModule,
    MatChipsModule, MatDividerModule, MatFormFieldModule, MatInputModule,
    MatProgressSpinnerModule, MatProgressBarModule, MatExpansionModule, MatSnackBarModule,
  ],
  template: `
    <div class="session-detail" *ngIf="session$ | async as session; else loading">

      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <button mat-icon-button routerLink="/dashboard" aria-label="Back">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div>
            <h1>Component {{ session.component }} Session</h1>
            <span class="session-id">{{ session.id }}</span>
          </div>
        </div>
        <span [class]="statusBadge(session.status)">{{ session.status }}</span>
      </div>

      <!-- Progress stepper -->
      <mat-card class="stepper-card">
        <mat-card-content>
          <div class="stepper">
            <div *ngFor="let gate of gatesFor(session.component); let i = index"
                 class="step" [class.step-active]="session.pendingGate === gate"
                 [class.step-done]="isGatePassed(session, gate)">
              <div class="step-circle">
                <mat-icon *ngIf="isGatePassed(session, gate)">check</mat-icon>
                <mat-icon *ngIf="session.pendingGate === gate">hourglass_top</mat-icon>
                <span *ngIf="!isGatePassed(session, gate) && session.pendingGate !== gate">{{ i + 1 }}</span>
              </div>
              <div class="step-label">{{ gateLabel(gate) }}</div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Gate decision panel — shown when a gate is pending -->
      <mat-card class="gate-panel" *ngIf="session.pendingGate">
        <mat-card-header>
          <mat-icon mat-card-avatar color="warn">pending_actions</mat-icon>
          <mat-card-title>Awaiting Your Decision</mat-card-title>
          <mat-card-subtitle>{{ gateLabel(session.pendingGate) }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p class="gate-instruction">
            Review the deliverables below. Approve to continue to the next phase,
            or reject with feedback to trigger a revision cycle.
          </p>

          <!-- Document download -->
          <div *ngIf="session.planDocumentKey" class="doc-row">
            <mat-icon>description</mat-icon>
            <a [href]="docDownloadUrl(session.planDocumentKey)" target="_blank" mat-button color="primary">
              Download Plan Document
            </a>
          </div>

          <mat-divider class="divider"></mat-divider>

          <!-- Decision form -->
          <form [formGroup]="gateForm" (ngSubmit)="submitGate(session)" class="gate-form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Feedback / Corrections (optional for approval, required for rejection)</mat-label>
              <textarea matInput formControlName="feedback" rows="5"
                        placeholder="Describe any required changes…"></textarea>
            </mat-form-field>

            <div class="gate-actions">
              <button mat-raised-button color="warn" type="button"
                      [disabled]="submitting || !gateForm.get('feedback')?.value?.trim()"
                      (click)="submitDecision(session, 'rejected')">
                <mat-icon>close</mat-icon> Reject &amp; Request Revision
              </button>
              <button mat-raised-button color="primary" type="button"
                      [disabled]="submitting"
                      (click)="submitDecision(session, 'approved')">
                <mat-icon>check</mat-icon> Approve &amp; Continue
              </button>
            </div>
            <mat-progress-bar *ngIf="submitting" mode="indeterminate" class="submit-progress"></mat-progress-bar>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Safe mode alert -->
      <mat-card class="safe-mode-card" *ngIf="session.status === 'SafeMode'">
        <mat-card-header>
          <mat-icon mat-card-avatar color="warn">warning</mat-icon>
          <mat-card-title>Safe Mode Active</mat-card-title>
          <mat-card-subtitle>An agent encountered an unrecoverable error and paused execution.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>Manual intervention is required. Review the agent log and contact your system administrator.</p>
        </mat-card-content>
      </mat-card>

      <!-- Currently running indicator -->
      <mat-card class="running-card" *ngIf="session.status === 'Active' && !session.pendingGate">
        <mat-card-content>
          <div class="running-indicator">
            <mat-spinner diameter="24"></mat-spinner>
            <span>{{ session.currentAgent || 'Initialising…' }}</span>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Agent execution log -->
      <mat-expansion-panel class="log-panel" *ngIf="sessionDetail$ | async as detail">
        <mat-expansion-panel-header>
          <mat-panel-title><mat-icon>history</mat-icon> Agent Execution Log</mat-panel-title>
          <mat-panel-description>{{ detail.agentLog?.length ?? 0 }} entries</mat-panel-description>
        </mat-expansion-panel-header>
        <div class="log-entries">
          <div *ngFor="let entry of detail.agentLog" class="log-entry">
            <span class="log-time">{{ entry.timestamp | date:'HH:mm:ss' }}</span>
            <mat-icon [class]="'log-icon log-' + entry.status">
              {{ entry.status === 'completed' ? 'check_circle' :
                 entry.status === 'failed'    ? 'error'        : 'radio_button_unchecked' }}
            </mat-icon>
            <span class="log-agent">{{ entry.agentName }}</span>
            <span class="log-summary" *ngIf="entry.outputSummary">— {{ entry.outputSummary }}</span>
          </div>
          <div *ngIf="!detail.agentLog?.length" class="log-empty">No log entries yet.</div>
        </div>
      </mat-expansion-panel>

    </div>

    <ng-template #loading>
      <div class="loading-state">
        <mat-spinner></mat-spinner>
        <p>Loading session…</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .session-detail { max-width: 900px; margin: 0 auto; }

    /* Header */
    .page-header  { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .header-left  { display: flex; align-items: center; gap: 0.5rem; }
    .session-id   { font-size: 0.75rem; color: #9e9e9e; font-family: monospace; }

    /* Status badges */
    .badge         { padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; }
    .badge-active  { background: #e3f2fd; color: #1565c0; }
    .badge-paused  { background: #fff3e0; color: #e65100; }
    .badge-complete{ background: #e8f5e9; color: #2e7d32; }
    .badge-safe    { background: #fce4ec; color: #880e4f; }

    /* Stepper */
    .stepper-card  { margin-bottom: 1.5rem; }
    .stepper       { display: flex; align-items: flex-start; gap: 0; }
    .step          { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
    .step:not(:last-child)::after {
      content: ''; position: absolute; top: 20px; left: 50%; width: 100%; height: 2px;
      background: #e0e0e0; z-index: 0;
    }
    .step-done::after, .step-active::after { background: #3949ab; }
    .step-circle   { width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0;
                     display: flex; align-items: center; justify-content: center;
                     z-index: 1; font-weight: 700; color: #fff; }
    .step-done .step-circle  { background: #3949ab; }
    .step-active .step-circle{ background: #e65100; }
    .step-label    { font-size: 0.75rem; text-align: center; margin-top: 0.5rem; color: #666; max-width: 120px; }
    .step-done .step-label, .step-active .step-label { color: #333; font-weight: 600; }

    /* Gate panel */
    .gate-panel     { margin-bottom: 1.5rem; border-left: 4px solid #e65100; }
    .gate-instruction { color: #555; margin-bottom: 1rem; }
    .doc-row        { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .divider        { margin: 1rem 0; }
    .gate-form      { margin-top: 0.5rem; }
    .full-width     { width: 100%; }
    .gate-actions   { display: flex; gap: 1rem; justify-content: flex-end; flex-wrap: wrap; margin-top: 0.5rem; }
    .submit-progress{ margin-top: 1rem; }

    /* Safe mode */
    .safe-mode-card { margin-bottom: 1.5rem; border-left: 4px solid #c62828; }

    /* Running indicator */
    .running-card   { margin-bottom: 1.5rem; }
    .running-indicator { display: flex; align-items: center; gap: 1rem; color: #555; }

    /* Log */
    .log-panel    { margin-bottom: 1.5rem; }
    .log-panel mat-icon { margin-right: 0.5rem; vertical-align: middle; }
    .log-entries  { max-height: 360px; overflow-y: auto; padding: 0.5rem 0; }
    .log-entry    { display: flex; align-items: center; gap: 0.75rem; padding: 0.3rem 0;
                    border-bottom: 1px solid #f5f5f5; font-size: 0.875rem; }
    .log-time     { color: #9e9e9e; font-family: monospace; min-width: 70px; }
    .log-icon     { font-size: 1.1rem; height: 1.1rem; width: 1.1rem; }
    .log-completed{ color: #2e7d32; }
    .log-failed   { color: #c62828; }
    .log-running  { color: #3949ab; }
    .log-agent    { font-weight: 600; }
    .log-summary  { color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .log-empty    { color: #9e9e9e; padding: 1rem 0; }

    /* Loading */
    .loading-state { display: flex; flex-direction: column; align-items: center; padding: 4rem; gap: 1rem; color: #9e9e9e; }
  `],
})
export class SessionDetailComponent implements OnInit, OnDestroy {
  session$!: Observable<Session | undefined>;
  sessionDetail$!: Observable<SessionDetail>;
  gateForm: FormGroup;
  submitting = false;

  private pollSub?: Subscription;
  private sessionId!: string;

  constructor(
    private route: ActivatedRoute,
    private store: Store<AppState>,
    private api: ApiService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
  ) {
    this.gateForm = this.fb.group({
      feedback: [''],
    });
  }

  ngOnInit() {
    this.sessionId = this.route.snapshot.paramMap.get('sessionId')!;

    this.store.dispatch(SessionActions.selectSession({ sessionId: this.sessionId }));

    this.session$ = this.store.select(s => s.session).pipe(
      map(selectSessionEntities),
      map(entities => entities[this.sessionId]),
    );

    this.sessionDetail$ = this.api.get<SessionDetail>(`/sessions/${this.sessionId}`);

    // Poll every 5 s while the page is open
    this.pollSub = interval(5000).pipe(
      startWith(0),
      switchMap(() => this.api.get<SessionDetail>(`/sessions/${this.sessionId}`)),
    ).subscribe(detail => {
      this.store.dispatch(SessionActions.sessionUpdated({ session: detail }));
    });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
  }

  gatesFor(component: number): string[] {
    return COMPONENT_GATES[component] ?? [];
  }

  gateLabel(gate: string): string {
    return GATE_LABELS[gate] ?? gate;
  }

  isGatePassed(session: Session, gate: string): boolean {
    // Gates are passed when status is Completed or when we are beyond this gate
    // The backend tracks this; we infer by comparing pending gate position
    const gates = this.gatesFor(session.component);
    const pendingIdx = session.pendingGate ? gates.indexOf(session.pendingGate) : gates.length;
    const gateIdx = gates.indexOf(gate);
    return gateIdx < pendingIdx || session.status === 'Completed';
  }

  statusBadge(status: string): string {
    const m: Record<string, string> = {
      Active: 'badge badge-active', Paused: 'badge badge-paused',
      Completed: 'badge badge-complete', SafeMode: 'badge badge-safe',
    };
    return m[status] ?? 'badge';
  }

  docDownloadUrl(key: string): string {
    return `/api/documents/download/${key}`;
  }

  submitDecision(session: Session, decision: 'approved' | 'rejected') {
    const feedback = this.gateForm.get('feedback')?.value ?? '';
    if (decision === 'rejected' && !feedback.trim()) {
      this.snackBar.open('Feedback is required when rejecting.', 'Close', { duration: 3000 });
      return;
    }

    this.submitting = true;
    this.store.dispatch(SessionActions.submitGateDecision({
      sessionId: session.id,
      gateId: session.pendingGate!,
      decision,
      feedbackJson: JSON.stringify({ feedback }),
    }));

    // Optimistically clear form and show confirmation; effects handle the API call
    this.gateForm.reset();
    this.snackBar.open(
      decision === 'approved' ? 'Gate approved — session continues.' : 'Revision requested — agents notified.',
      'Close',
      { duration: 4000 },
    );
    // Submitting flag will be cleared on next poll update
    setTimeout(() => { this.submitting = false; }, 2000);
  }

  submitGate(session: Session) {}
}
