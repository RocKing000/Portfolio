import { createAction, props } from '@ngrx/store';
import { Session } from '../../core/services/session.service';

export const loadSessions = createAction(
  '[Session] Load Sessions',
  props<{ projectId?: string }>()
);
export const loadSessionsSuccess = createAction(
  '[Session] Load Sessions Success',
  props<{ sessions: Session[] }>()
);
export const loadSessionsFailure = createAction(
  '[Session] Load Sessions Failure',
  props<{ error: string }>()
);
export const selectSession = createAction(
  '[Session] Select Session',
  props<{ sessionId: string }>()
);
export const sessionUpdated = createAction(
  '[Session] Session Updated',
  props<{ session: Session }>()
);
export const submitGateDecision = createAction(
  '[Session] Submit Gate Decision',
  props<{ sessionId: string; gateId: string; decision: 'approved' | 'rejected'; feedbackJson: string }>()
);
export const submitGateDecisionSuccess = createAction(
  '[Session] Submit Gate Decision Success',
  props<{ nextAction: string }>()
);
