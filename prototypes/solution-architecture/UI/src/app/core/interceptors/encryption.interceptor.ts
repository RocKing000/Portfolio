import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, of, switchMap, map, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CryptoService } from '../services/crypto.service';
import { AuthService } from '../services/auth.service';
import { GlobalRequest, GlobalResponse } from '../models/auth.model';

/** URL path segments that use the date-based key instead of the session encryption key. */
const PUBLIC_PATHS = ['/auth/login', '/auth/reset', '/auth/verify', '/auth/otp'];

/**
 * Transparently wraps every POST to the FedMithra API in GlobalRequest (encrypted)
 * and unwraps GlobalResponse (decrypted) on the way back.
 *
 * Falls through unchanged for:
 *  - Non-POST requests
 *  - Requests outside the configured API base URL
 */
export const encryptionInterceptor: HttpInterceptorFn = (req, next) => {
  const crypto = inject(CryptoService);
  const auth   = inject(AuthService);

  const apiBase = `${environment.apiUrl}/api/v2/`;
  if (req.method !== 'POST' || !req.url.startsWith(apiBase)) {
    return next(req);
  }

  const isPublic = PUBLIC_PATHS.some(p => req.url.includes(p));
  const encKey   = isPublic
    ? crypto.getDateBasedKey()
    : (auth.getEncryptionKey() ?? crypto.getDateBasedKey());

  const txnType = isPublic ? 'USER_LOGIN' : 'FEDMITHRA_REQUEST';
  const payload = JSON.stringify(req.body ?? {});

  console.log('🔐 [Interceptor] Encrypting request:', { url: req.url, isPublic, txnType });

  return from(crypto.encrypt(payload, encKey)).pipe(
    switchMap(encryptedPayload => {
      console.log('✅ [Interceptor] Request encrypted successfully');

      const globalReq: GlobalRequest = {
        channelId:                  'WEB',
        digitalSignature:           '',
        encryptedPayload,
        requestId:                  isPublic ? '0' : String(auth.currentUser?.user?.userId ?? '0'),
        requestTime:                new Date().toISOString(),
        transactionReferenceNumber: crypto.randomUUID(),
        transactionType:            txnType,
        versionNo:                  '2.0'
      };

      return next(req.clone({
        body: globalReq,
        setHeaders: { 'Content-Type': 'application/json' }
      }));
    }),

    switchMap(event => {
      if (!(event instanceof HttpResponse) || !event.body) return of(event);

      const body = event.body as GlobalResponse;

      // Support both PascalCase (.NET default) and camelCase serialization
      const responseData = body.ResponseData ?? body.responseData;
      const responseError = body.Error ?? body.error;

      console.log('📥 [Interceptor] Received response:', {
        code: body.ResponseCode ?? body.responseCode,
        hasData: !!responseData,
        hasError: !!responseError
      });

      if (responseError) {
        const err = responseError as any;
        const description = err.Description ?? err.description ?? 'API error';
        console.error('❌ [Interceptor] API error:', { code: err.Code ?? err.code, description });
        return throwError(() => new Error(description));
      }

      if (!responseData) return of(event);

      console.log('🔓 [Interceptor] Decrypting response...');

      return from(crypto.decrypt(responseData, encKey)).pipe(
        map(decrypted => {
          let parsed: unknown;
          try { parsed = JSON.parse(decrypted); } catch { parsed = decrypted; }
          console.log('✅ [Interceptor] Response decrypted successfully');
          console.log('📄 [Interceptor] Decrypted data:', parsed);
          return event.clone({ body: parsed });
        }),
        catchError(err => {
          console.error('❌ [Interceptor] Decryption error:', err);
          return throwError(() => new Error('Failed to decrypt response'));
        })
      );
    })
  );
};
