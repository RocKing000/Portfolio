import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Session {
  id: string;
  projectId: string;
  component: number;
  status: 'Active' | 'Paused' | 'Completed' | 'SafeMode';
  currentAgent: string;
  pendingGate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GateDecision {
  sessionId: string;
  gateId: string;
  decision: 'approved' | 'rejected';
  feedbackJson: string;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  constructor(private api: ApiService) {}

  getSessions(projectId?: string): Observable<Session[]> {
    const params = projectId ? { projectId } : undefined;
    return this.api.get<Session[]>('/sessions', params);
  }

  getSession(sessionId: string): Observable<Session> {
    return this.api.get<Session>(`/sessions/${sessionId}`);
  }

  createSession(projectId: string, component: number, operatingMode: string): Observable<Session> {
    return this.api.post<Session>('/sessions', { projectId, component, operatingMode });
  }

  submitGateDecision(decision: GateDecision): Observable<{ accepted: boolean; nextAction: string }> {
    return this.api.post(`/sessions/${decision.sessionId}/gate-decision`, decision);
  }
}
