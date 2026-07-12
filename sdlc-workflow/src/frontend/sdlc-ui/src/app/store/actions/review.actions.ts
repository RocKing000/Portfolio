import { createAction, props } from '@ngrx/store';
import { ReviewItem } from '../../core/services/review.service';

export const loadReviewQueue = createAction('[Review] Load Queue');
export const loadReviewQueueSuccess = createAction(
  '[Review] Load Queue Success',
  props<{ items: ReviewItem[] }>()
);
export const loadReviewQueueFailure = createAction(
  '[Review] Load Queue Failure',
  props<{ error: string }>()
);
export const claimItem = createAction(
  '[Review] Claim Item',
  props<{ itemId: string }>()
);
export const claimItemSuccess = createAction(
  '[Review] Claim Item Success',
  props<{ item: ReviewItem }>()
);
export const submitDecision = createAction(
  '[Review] Submit Decision',
  props<{ itemId: string; decision: 'Approved' | 'Rejected'; notes: string }>()
);
export const submitDecisionSuccess = createAction(
  '[Review] Submit Decision Success',
  props<{ itemId: string }>()
);
