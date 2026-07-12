import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  AppConfigItem, UiConfigItem, UserListItem, RoleListItem, TenantListItem,
  ErrorListItem, AuditLogEntry,
  CreateUserRequest, UpdateUserRequest, ResetPasswordRequest,
  CreateTenantRequest, CreateErrorRequest
} from '../models/admin.models';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/v2/admin`;

  // ── App Config ──────────────────────────────────────────────────────────────

  getAppConfigs(category?: string): Observable<AppConfigItem[]> {
    const params = category ? `?category=${category}` : '';
    return this.http.get<ApiResponse<AppConfigItem[]>>(`${this.baseUrl}/config/app${params}`)
      .pipe(map(r => r.data ?? []));
  }

  createAppConfig(request: Partial<AppConfigItem>): Observable<boolean> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/config/app`, request)
      .pipe(map(r => r.success));
  }

  updateAppConfig(request: Partial<AppConfigItem>): Observable<boolean> {
    return this.http.put<ApiResponse<void>>(`${this.baseUrl}/config/app`, request)
      .pipe(map(r => r.success));
  }

  deleteAppConfig(configId: number): Observable<boolean> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/config/app/${configId}`)
      .pipe(map(r => r.success));
  }

  // ── UI Config ───────────────────────────────────────────────────────────────

  getUiConfigs(section?: string): Observable<UiConfigItem[]> {
    const params = section ? `?section=${section}` : '';
    return this.http.get<ApiResponse<UiConfigItem[]>>(`${this.baseUrl}/config/ui${params}`)
      .pipe(map(r => r.data ?? []));
  }

  updateUiConfig(configId: number, configValue: string): Observable<boolean> {
    return this.http.put<ApiResponse<void>>(`${this.baseUrl}/config/ui/${configId}`, { configValue })
      .pipe(map(r => r.success));
  }

  // ── Users ───────────────────────────────────────────────────────────────────

  getUsers(tenantId?: string): Observable<UserListItem[]> {
    const params = tenantId ? `?tenantId=${tenantId}` : '';
    return this.http.get<ApiResponse<UserListItem[]>>(`${this.baseUrl}/users${params}`)
      .pipe(map(r => r.data ?? []));
  }

  getRoles(): Observable<RoleListItem[]> {
    return this.http.get<ApiResponse<RoleListItem[]>>(`${this.baseUrl}/users/roles`)
      .pipe(map(r => r.data ?? []));
  }

  createUser(request: CreateUserRequest): Observable<boolean> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/users`, request)
      .pipe(map(r => r.success));
  }

  updateUser(request: UpdateUserRequest): Observable<boolean> {
    return this.http.put<ApiResponse<void>>(`${this.baseUrl}/users`, request)
      .pipe(map(r => r.success));
  }

  resetPassword(request: ResetPasswordRequest): Observable<boolean> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/users/reset-password`, request)
      .pipe(map(r => r.success));
  }

  deleteUser(userId: string): Observable<boolean> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/users/${userId}`)
      .pipe(map(r => r.success));
  }

  // ── Tenants ─────────────────────────────────────────────────────────────────

  getTenants(): Observable<TenantListItem[]> {
    return this.http.get<ApiResponse<TenantListItem[]>>(`${this.baseUrl}/tenants`)
      .pipe(map(r => r.data ?? []));
  }

  createTenant(request: CreateTenantRequest): Observable<boolean> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/tenants`, request)
      .pipe(map(r => r.success));
  }

  updateTenant(tenantId: string, tenantName: string, description?: string): Observable<boolean> {
    return this.http.put<ApiResponse<void>>(`${this.baseUrl}/tenants/${tenantId}`, { tenantName, description })
      .pipe(map(r => r.success));
  }

  // ── Errors ──────────────────────────────────────────────────────────────────

  getErrors(tenantCode?: string): Observable<ErrorListItem[]> {
    const params = tenantCode ? `?tenantCode=${tenantCode}` : '';
    return this.http.get<ApiResponse<ErrorListItem[]>>(`${this.baseUrl}/errors${params}`)
      .pipe(map(r => r.data ?? []));
  }

  createError(request: CreateErrorRequest): Observable<boolean> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/errors`, request)
      .pipe(map(r => r.success));
  }

  updateError(errorId: string, request: CreateErrorRequest): Observable<boolean> {
    return this.http.put<ApiResponse<void>>(`${this.baseUrl}/errors/${errorId}`, request)
      .pipe(map(r => r.success));
  }

  deleteError(errorId: string): Observable<boolean> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/errors/${errorId}`)
      .pipe(map(r => r.success));
  }

  // ── Audit Log ────────────────────────────────────────────────────────────────

  getAuditLogs(pageSize = 100, pageNumber = 1): Observable<AuditLogEntry[]> {
    return this.http.get<ApiResponse<AuditLogEntry[]>>(
      `${this.baseUrl}/audit?pageSize=${pageSize}&pageNumber=${pageNumber}`)
      .pipe(map(r => r.data ?? []));
  }
}
