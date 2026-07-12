import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Signal,
  SignalDetails,
  SignalAggregation,
  ClassificationResult,
  CreateSignalRequest,
  UpdateStatusRequest,
  AssignSignalRequest,
  AddCommentRequest,
  SignalComment
} from '../models/signal.model';

interface ApiResult<T> { success: boolean; data: T; message?: string }

@Injectable({ providedIn: 'root' })
export class SignalService {
  private readonly http   = inject(HttpClient);
  private readonly base   = `${environment.apiUrl}/api/signal`;

  createSignal(request: CreateSignalRequest): Observable<ApiResult<Signal>> {
    return this.http.post<ApiResult<Signal>>(this.base, request);
  }

  getOpenSignals(
    topN        : number  = 50,
    minSeverity?: number,
    signalType ?: string
  ): Observable<ApiResult<Signal[]>> {
    let params = new HttpParams().set('topN', topN);
    if (minSeverity != null) params = params.set('minSeverity', minSeverity);
    if (signalType)          params = params.set('signalType', signalType);
    return this.http.get<ApiResult<Signal[]>>(`${this.base}/open`, { params });
  }

  getAssignedSignals(topN: number = 50): Observable<ApiResult<Signal[]>> {
    return this.http.get<ApiResult<Signal[]>>(`${this.base}/assigned`, {
      params: new HttpParams().set('topN', topN)
    });
  }

  getAggregations(periodType: string = 'DAY', lastN: number = 30): Observable<ApiResult<SignalAggregation[]>> {
    const params = new HttpParams().set('periodType', periodType).set('lastN', lastN);
    return this.http.get<ApiResult<SignalAggregation[]>>(`${this.base}/aggregations`, { params });
  }

  getSignalDetails(id: string): Observable<ApiResult<SignalDetails>> {
    return this.http.get<ApiResult<SignalDetails>>(`${this.base}/${id}`);
  }

  updateStatus(id: string, request: UpdateStatusRequest): Observable<ApiResult<Signal>> {
    return this.http.put<ApiResult<Signal>>(`${this.base}/${id}/status`, request);
  }

  assignSignal(id: string, request: AssignSignalRequest): Observable<ApiResult<Signal>> {
    return this.http.put<ApiResult<Signal>>(`${this.base}/${id}/assign`, request);
  }

  addComment(id: string, request: AddCommentRequest): Observable<ApiResult<SignalComment>> {
    return this.http.post<ApiResult<SignalComment>>(`${this.base}/${id}/comment`, request);
  }

  classifySignal(id: string): Observable<ApiResult<ClassificationResult>> {
    return this.http.post<ApiResult<ClassificationResult>>(`${this.base}/${id}/classify`, {});
  }
}
