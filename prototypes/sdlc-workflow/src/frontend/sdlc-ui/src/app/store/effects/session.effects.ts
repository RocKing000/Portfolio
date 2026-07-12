import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import * as SessionActions from '../actions/session.actions';
import { SessionService } from '../../core/services/session.service';

@Injectable()
export class SessionEffects {
  loadSessions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SessionActions.loadSessions),
      switchMap(({ projectId }) =>
        this.sessionService.getSessions(projectId).pipe(
          map(sessions => SessionActions.loadSessionsSuccess({ sessions })),
          catchError(err => of(SessionActions.loadSessionsFailure({ error: err.message })))
        )
      )
    )
  );

  submitGateDecision$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SessionActions.submitGateDecision),
      mergeMap(({ sessionId, gateId, decision, feedbackJson }) =>
        this.sessionService.submitGateDecision({ sessionId, gateId, decision, feedbackJson }).pipe(
          map(res => SessionActions.submitGateDecisionSuccess({ nextAction: res.nextAction })),
          catchError(() => of(SessionActions.loadSessionsFailure({ error: 'Gate decision failed' })))
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private sessionService: SessionService,
  ) {}
}
