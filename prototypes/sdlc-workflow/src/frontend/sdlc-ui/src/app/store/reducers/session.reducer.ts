import { createReducer, on } from '@ngrx/store';
import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { Session } from '../../core/services/session.service';
import * as SessionActions from '../actions/session.actions';

export interface SessionState extends EntityState<Session> {
  selectedSessionId: string | null;
  loading: boolean;
  error: string | null;
}

const adapter: EntityAdapter<Session> = createEntityAdapter<Session>();

const initialState: SessionState = adapter.getInitialState({
  selectedSessionId: null,
  loading: false,
  error: null,
});

export const sessionReducer = createReducer(
  initialState,

  on(SessionActions.loadSessions, state => ({ ...state, loading: true, error: null })),
  on(SessionActions.loadSessionsSuccess, (state, { sessions }) =>
    adapter.setAll(sessions, { ...state, loading: false })),
  on(SessionActions.loadSessionsFailure, (state, { error }) =>
    ({ ...state, loading: false, error })),

  on(SessionActions.selectSession, (state, { sessionId }) =>
    ({ ...state, selectedSessionId: sessionId })),

  on(SessionActions.sessionUpdated, (state, { session }) =>
    adapter.upsertOne(session, state)),
);

export const { selectAll: selectAllSessions, selectEntities: selectSessionEntities } =
  adapter.getSelectors();
