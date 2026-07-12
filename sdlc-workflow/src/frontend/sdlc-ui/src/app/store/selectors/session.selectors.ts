import { createSelector } from '@ngrx/store';
import { AppState } from '../reducers';
import { selectAllSessions, selectSessionEntities } from '../reducers/session.reducer';

const selectSessionState = (state: AppState) => state.session;

export const selectSessions = createSelector(selectSessionState, selectAllSessions);

export const selectSessionById = (id: string) =>
  createSelector(selectSessionState, state => selectSessionEntities(state)[id]);

export const selectActiveSessions = createSelector(
  selectSessions,
  sessions => sessions.filter(s => s.status === 'Active' || s.status === 'Paused'),
);

export const selectSafeModeSessions = createSelector(
  selectSessions,
  sessions => sessions.filter(s => s.status === 'SafeMode'),
);

export const selectCompletedSessions = createSelector(
  selectSessions,
  sessions => sessions.filter(s => s.status === 'Completed'),
);

export const selectSessionsLoading = createSelector(selectSessionState, s => s.loading);
export const selectSessionsError   = createSelector(selectSessionState, s => s.error);
