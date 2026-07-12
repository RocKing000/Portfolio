import { createSelector } from '@ngrx/store';
import { AppState } from '../reducers';
import { selectAllItems } from '../reducers/review.reducer';

const selectReviewState = (state: AppState) => state.review;

export const selectReviewItems = createSelector(selectReviewState, selectAllItems);

export const selectPendingReviewItems = createSelector(
  selectReviewItems,
  items => items.filter(i => i.status === 'Pending'),
);

export const selectPendingCount = createSelector(
  selectPendingReviewItems,
  items => items.length,
);

export const selectReviewLoading = createSelector(selectReviewState, s => s.loading);
