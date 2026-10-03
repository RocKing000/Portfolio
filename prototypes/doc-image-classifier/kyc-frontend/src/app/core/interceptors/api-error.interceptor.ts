import { HttpInterceptorFn, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, TimeoutError } from 'rxjs';
import { ToastService } from '../services/toast.service';

/** Set this token to true on requests that should never show a toast on error (e.g. polling). */
export const SILENT_ERROR = new HttpContextToken<boolean>(() => false);

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const silent = req.context.get(SILENT_ERROR);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!silent) {
        let message: string;

        if (err instanceof TimeoutError) {
          message = 'Request timed out. Please try again.';
        } else if (err instanceof HttpErrorResponse) {
          switch (err.status) {
            case 0:   message = 'Cannot connect to server. Check your connection.'; break;
            case 400: message = 'Invalid request. Please try again.'; break;
            case 413: message = 'Image too large. Please use a smaller image.'; break;
            case 422: message = 'Image could not be processed. Please retake.'; break;
            case 500: message = 'Server error. Please try again in a moment.'; break;
            default:  message = `Error ${err.status}: ${err.statusText}`;
          }
        } else {
          message = 'An unexpected error occurred.';
        }

        toast.show(message, 'error');
      }

      return throwError(() => err);
    })
  );
};
