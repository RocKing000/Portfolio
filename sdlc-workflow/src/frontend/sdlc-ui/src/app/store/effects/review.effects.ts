import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import * as ReviewActions from '../actions/review.actions';
import { ReviewService } from '../../core/services/review.service';

@Injectable()
export class ReviewEffects {
  loadQueue$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.loadReviewQueue),
      switchMap(() =>
        this.reviewService.getQueue('Pending').pipe(
          map(items => ReviewActions.loadReviewQueueSuccess({ items })),
          catchError(err => of(ReviewActions.loadReviewQueueFailure({ error: err.message })))
        )
      )
    )
  );

  claimItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.claimItem),
      mergeMap(({ itemId }) =>
        this.reviewService.claimItem(itemId).pipe(
          map(item => ReviewActions.claimItemSuccess({ item })),
          catchError(() => of(ReviewActions.loadReviewQueueFailure({ error: 'Claim failed' })))
        )
      )
    )
  );

  submitDecision$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.submitDecision),
      mergeMap(({ itemId, decision, notes }) =>
        this.reviewService.submitDecision(itemId, decision, notes).pipe(
          map(() => ReviewActions.submitDecisionSuccess({ itemId })),
          catchError(() => of(ReviewActions.loadReviewQueueFailure({ error: 'Decision failed' })))
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private reviewService: ReviewService,
  ) {}
}
