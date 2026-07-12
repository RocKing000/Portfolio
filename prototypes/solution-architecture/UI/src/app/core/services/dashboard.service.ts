import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Layout,
  LayoutDetails,
  Widget,
  WidgetTemplate,
  LayoutShare,
  CreateLayoutRequest,
  AddWidgetRequest,
  UpdateWidgetRequest,
  ShareLayoutRequest
} from '../models/dashboard.model';

interface ApiResult<T> { success: boolean; data: T; message?: string }

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/dashboard`;

  createLayout(request: CreateLayoutRequest): Observable<ApiResult<Layout>> {
    return this.http.post<ApiResult<Layout>>(`${this.base}/layouts`, request);
  }

  getLayouts(includeShared = true): Observable<ApiResult<Layout[]>> {
    const params = new HttpParams().set('includeShared', includeShared);
    return this.http.get<ApiResult<Layout[]>>(`${this.base}/layouts`, { params });
  }

  getLayoutDetails(id: string): Observable<ApiResult<LayoutDetails>> {
    return this.http.get<ApiResult<LayoutDetails>>(`${this.base}/layouts/${id}`);
  }

  deleteLayout(id: string): Observable<ApiResult<null>> {
    return this.http.delete<ApiResult<null>>(`${this.base}/layouts/${id}`);
  }

  shareLayout(layoutId: string, request: ShareLayoutRequest): Observable<ApiResult<LayoutShare>> {
    return this.http.post<ApiResult<LayoutShare>>(
      `${this.base}/layouts/${layoutId}/share`,
      request
    );
  }

  addWidget(request: AddWidgetRequest): Observable<ApiResult<Widget>> {
    return this.http.post<ApiResult<Widget>>(`${this.base}/widgets`, request);
  }

  updateWidgetPosition(widgetId: string, position: string): Observable<ApiResult<Widget>> {
    return this.http.put<ApiResult<Widget>>(
      `${this.base}/widgets/${widgetId}/position`,
      { position }
    );
  }

  updateWidgetConfig(widgetId: string, request: UpdateWidgetRequest): Observable<ApiResult<Widget>> {
    return this.http.put<ApiResult<Widget>>(
      `${this.base}/widgets/${widgetId}/config`,
      request
    );
  }

  deleteWidget(widgetId: string): Observable<ApiResult<null>> {
    return this.http.delete<ApiResult<null>>(`${this.base}/widgets/${widgetId}`);
  }

  getWidgetTemplates(category?: string, premiumOk = false): Observable<ApiResult<WidgetTemplate[]>> {
    let params = new HttpParams().set('premiumOk', premiumOk);
    if (category) params = params.set('category', category);
    return this.http.get<ApiResult<WidgetTemplate[]>>(`${this.base}/templates`, { params });
  }
}
