import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface ReviewItem {
  id: string;
  sessionId: string;
  projectId: string;
  reviewType: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  planMinioKey: string;
  contextSummary: string;
  status: 'Pending' | 'InReview' | 'Approved' | 'Rejected';
  assignedTo: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  constructor(private api: ApiService) {}

  getQueue(status?: string): Observable<ReviewItem[]> {
    return this.api.get<ReviewItem[]>('/review/queue', status ? { status } : undefined);
  }

  claimItem(itemId: string): Observable<ReviewItem> {
    return this.api.post<ReviewItem>(`/review/queue/${itemId}/claim`, {});
  }

  submitDecision(itemId: string, decision: 'Approved' | 'Rejected', notes: string): Observable<void> {
    return this.api.post<void>(`/review/queue/${itemId}/decision`, { decision, notes });
  }
}
