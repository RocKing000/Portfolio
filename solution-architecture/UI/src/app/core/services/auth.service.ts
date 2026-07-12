import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LoginResponse, UserDto, EnterpriseChatbotSession } from '../models/auth.model';
import { CryptoService } from './crypto.service';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

const SESSION_KEY = 'fedmithra_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly crypto = inject(CryptoService);
  private readonly base   = `${environment.apiUrl}/api/v2/auth`;

  private readonly _session$ = new BehaviorSubject<EnterpriseChatbotSession | null>(
    this.loadSession()
  );

  readonly currentUser$: Observable<EnterpriseChatbotSession | null> = this._session$.asObservable();

  get currentUser(): EnterpriseChatbotSession | null {
    return this._session$.value;
  }

  get currentUserDto(): UserDto | null {
    return this._session$.value?.user ?? null;
  }

  isAuthenticated(): boolean {
    const session = this._session$.value;
    if (!session?.token) return false;
    if (new Date(session.expiresAt) <= new Date()) {
      this.clearSession();
      return false;
    }
    return true;
  }

  getToken(): string | null {
    return this._session$.value?.token ?? null;
  }

  /** 32-char hex key used by the encryption interceptor for authenticated POST requests. */
  getEncryptionKey(): string | null {
    return this._session$.value?.encryptionKey ?? null;
  }

  /**
   * Login flow (encryption handled transparently by encryptionInterceptor):
   * 1. Compute MD5(username + password) — this is the password hash
   * 2. POST plain { UserName, Password: md5 } → interceptor wraps in GlobalRequest
   * 3. Interceptor decrypts GlobalResponse back to ApiResponse<LoginResponse>
   * 4. Save session with encryption key = md5 without hyphens
   */
  login(username: string, password: string): Observable<LoginResponse> {
    const md5hash = this.crypto.md5(username + password);
    const encKey  = md5hash.replace(/-/g, '');

    return this.http
      .post<any>(`${this.base}/login`, {
        UserName: username,
        Password: md5hash
      })
      .pipe(
        map(r => {
          // Backend may return { success, data } (camelCase) or { Success, Data } (PascalCase)
          const successFlag = r?.success ?? r?.Success;
          if (successFlag === true || successFlag === 'true') {
            const data = r.data ?? r.Data;
            if (!data) throw new Error(r?.message ?? r?.Message ?? 'Invalid credentials');
            return this.normalizeLoginResponse(data);
          }

          // Backend may return LoginResponse directly (no ApiResponse wrapper)
          const token = r?.token ?? r?.Token;
          if (token) {
            return this.normalizeLoginResponse(r);
          }

          // Explicit failure
          const errMsg = r?.message ?? r?.Message ?? r?.error ?? r?.Error ?? 'Invalid credentials';
          throw new Error(typeof errMsg === 'string' ? errMsg : 'Invalid credentials');
        }),
        tap(data => this.saveSession({ ...data, encryptionKey: encKey }))
      );
  }

  private normalizeLoginResponse(r: any): LoginResponse {
    return {
      token:        r.token        ?? r.Token,
      refreshToken: r.refreshToken ?? r.RefreshToken ?? '',
      expiresAt:    r.expiresAt    ?? r.ExpiresAt    ?? '',
      user: r.user ?? r.User ?? {
        userId:     r.userId     ?? r.UserId     ?? r.UserID     ?? 0,
        username:   r.username   ?? r.UserName   ?? r.Username   ?? '',
        email:      r.email      ?? r.Email      ?? '',
        fullName:   r.fullName   ?? r.FullName   ?? '',
        role:       r.role       ?? r.Role       ?? '',
        tenantCode: r.tenantCode ?? r.TenantCode ?? '',
        tenantName: r.tenantName ?? r.TenantName ?? ''
      }
    };
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private saveSession(session: EnterpriseChatbotSession): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this._session$.next(session);
  }

  private loadSession(): EnterpriseChatbotSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private clearSession(): void {
    sessionStorage.removeItem(SESSION_KEY);
    this._session$.next(null);
  }
}
