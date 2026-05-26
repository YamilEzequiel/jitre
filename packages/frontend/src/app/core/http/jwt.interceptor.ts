import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, from, switchMap, catchError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/**
 * Auth endpoints whose own 401 means "bad credentials / no session" — NOT an
 * expired access token. These must NEVER trigger refresh-then-retry, otherwise
 * a failed login loops forever.
 */
const AUTH_PUBLIC_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/request-password-reset',
];

function isAuthPublic(url: string): boolean {
  return AUTH_PUBLIC_PATHS.some((p) => url.includes(p));
}

function addBearer(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token) return req;
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const jwtInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const auth = inject(AuthService);
  const token = auth.getAccessToken();

  return next(addBearer(req, token)).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isAuthPublic(req.url)
      ) {
        return from(auth.refresh()).pipe(
          switchMap(() => {
            const newToken = auth.getAccessToken();
            return next(addBearer(req, newToken));
          }),
          catchError(refreshError => {
            auth.logout();
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
