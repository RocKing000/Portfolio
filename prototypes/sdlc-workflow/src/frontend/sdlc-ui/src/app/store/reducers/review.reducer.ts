import { createReducer, on } from '@ngrx/store';
import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { ReviewItem } from '../../core/services/review.service';
import * as ReviewActions from '../actions/review.actions';

export interface ReviewState extends EntityState<ReviewItem> {
  loading: boolean;
  error: string | null;
}

const adapter: EntityAdapter<ReviewItem> = createEntityAdapter<ReviewItem>();

const initialState: ReviewState = adapter.getInitialState({
  loading: false,
  error: null,
});

export const reviewReducer = createReducer(
  initialState,

  on(ReviewActions.loadReviewQueue, state => ({ ...state, loading: true })),
  on(ReviewActions.loadReviewQueueSuccess, (state, { items }) =>
    adapter.setAll(items, { ...state, loading: false })),
  on(ReviewActions.loadReviewQueueFailure, (state, { error }) =>
    ({ ...state, loading: false, error })),

  on(ReviewActions.claimItemSuccess, (state, { item }) =>
    adapter.upsertOne(item, state)),
  on(ReviewActions.submitDecisionSuccess, (state, { itemId }) =>
    adapter.removeOne(itemId, state)),
);

export const { selectAll: selectAllReviewItems } = adapter.getSelectors();
