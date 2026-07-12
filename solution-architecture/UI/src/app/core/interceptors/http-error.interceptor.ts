import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!environment.production) {
        console.error('[HTTP Error]', error);
      }

      // Non-HttpErrorResponse (e.g. plain Error from encryption interceptor) — use its message directly
      if (!(error instanceof HttpErrorResponse)) {
        const plainMsg = (error as any)?.message ?? 'An unexpected error occurred.';
        snackBar.open(plainMsg, 'Dismiss', { duration: 5000, panelClass: ['error-snackbar'], horizontalPosition: 'end', verticalPosition: 'top' });
        return throwError(() => error);
      }

      let message = 'An unexpected error occurred.';

      if (error.status === 0) {
        message = 'Cannot connect to the server. Check your network.';
      } else if (error.status === 400) {
        const err = error.error?.error ?? error.error?.message;
        message = err ?? 'Invalid request.';
      } else if (error.status === 401) {
        message = 'Session expired. Please log in again.';
      } else if (error.status === 404) {
        message = 'Resource not found.';
      } else if (error.status === 500) {
        const detail = error.error?.message;
        message = detail ?? 'Server error. Please try again later.';
      }

      snackBar.open(message, 'Dismiss', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });

      return throwError(() => error);
    })
  );
};
