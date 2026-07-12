import { ActionReducerMap, MetaReducer } from '@ngrx/store';
import { routerReducer, RouterReducerState } from '@ngrx/router-store';
import { sessionReducer, SessionState } from './session.reducer';
import { reviewReducer, ReviewState } from './review.reducer';
import { environment } from '../../../environments/environment';

export interface AppState {
  router:  RouterReducerState;
  session: SessionState;
  review:  ReviewState;
}

export const reducers: ActionReducerMap<AppState> = {
  router:  routerReducer,
  session: sessionReducer,
  review:  reviewReducer,
};

export const metaReducers: MetaReducer<AppState>[] = environment.production ? [] : [];
