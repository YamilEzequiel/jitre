import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, catchError } from 'rxjs';
import { ToastService } from '../toast/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status !== 401) {
        const body = error.error as { title?: string };
        const message = body?.title ?? `HTTP ${error.status}`;
        toast.error(message);
      }
      return throwError(() => error);
    }),
  );
};
