import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  TrendingError,
  DashboardMetrics,
  FeedbackRequest,
  FeedbackResponse
} from '../models/analytics.model';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/v2/analytics`;

  getTrendingErrors(
    tenantCode: string | null | undefined,
    periodType: string,
    topN: number
  ): Observable<TrendingError[]> {
    let params = new HttpParams()
      .set('period', periodType)
      .set('limit', topN);
    if (tenantCode) params = params.set('tenantCode', tenantCode);
    return this.http.get<ApiResponse<TrendingError[]>>(
      `${this.base}/trending`, { params }
    ).pipe(map(r => r.data ?? []));
  }

  getDashboardMetrics(
    tenantCode?: string | null,
    fromDate?: Date | null,
    toDate?: Date | null
  ): Observable<DashboardMetrics[]> {
    let params = new HttpParams();
    if (tenantCode) params = params.set('tenantCode', tenantCode);
    if (fromDate) params = params.set('fromDate', fromDate.toISOString());
    if (toDate) params = params.set('toDate', toDate.toISOString());
    return this.http.get<ApiResponse<DashboardMetrics[]>>(
      `${this.base}/dashboard`, { params }
    ).pipe(map(r => r.data ?? []));
  }

  submitFeedback(request: FeedbackRequest): Observable<FeedbackResponse> {
    return this.http.post<ApiResponse<FeedbackResponse>>(
      `${this.base}/feedback`, request
    ).pipe(map(r => r.data));
  }

  trackErrorView(mappingId: number, userId?: string, tenantCode?: string): Observable<unknown> {
    return this.http.post(`${this.base}/track/${mappingId}`, {});
  }
}
