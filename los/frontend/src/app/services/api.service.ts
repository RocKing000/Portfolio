import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private get<T>(path: string, params?: Record<string, string>): Observable<T> {
    let p = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) p = p.set(k, v); });
    return this.http.get<T>(`${this.base}/${path}`, { params: p }).pipe(
      catchError(err => { console.error(path, err); return of(null as unknown as T); })
    );
  }

  private post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}/${path}`, body).pipe(
      catchError(err => { console.error(path, err); return of(null as unknown as T); })
    );
  }

  health()                             { return this.get('health'); }
  summary()                            { return this.get<any>('summary'); }
  trends()                             { return this.get<any[]>('trends'); }
  buckets(month?: string)              { return this.get<any>('buckets', month ? { month } : {}); }
  bucketMovement()                     { return this.get<any>('bucket-movement'); }
  topCritical(n = 10)                  { return this.get<any[]>('top-critical', { n: String(n) }); }
  flags(month?: string)                { return this.get<any[]>('flags', month ? { month } : {}); }
  pool(name: string, month?: string)   { return this.get<any>(`pool/${encodeURIComponent(name)}`, month ? { month } : {}); }
  hierarchy(month?: string)            { return this.get<any>('hierarchy', month ? { month } : {}); }
  modelMetrics()                       { return this.get<any>('models/metrics'); }

  loans(params: { month?: string; bucket?: string; search?: string; page?: number; size?: number } = {}) {
    const p: Record<string, string> = {};
    if (params.month)  p['month']  = params.month;
    if (params.bucket) p['bucket'] = params.bucket;
    if (params.search) p['search'] = params.search;
    if (params.page)   p['page']   = String(params.page);
    if (params.size)   p['size']   = String(params.size);
    return this.get<any>('loans', p);
  }

  loanDetail(id: string, month?: string) {
    return this.get<any>(`loan/${id}`, month ? { month } : {});
  }

  predict(modelName: string, payload: { loan_id?: string; month?: string; features?: Record<string, number> }) {
    return this.post<any>(`predict/${modelName}`, payload);
  }

  exportPool(pool: string, month?: string): Observable<Blob> {
    const p = month ? `?month=${month}` : '';
    return this.http.get(`${this.base}/export/pool/${encodeURIComponent(pool)}${p}`,
      { responseType: 'blob' });
  }
}
