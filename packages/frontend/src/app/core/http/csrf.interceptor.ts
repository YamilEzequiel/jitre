import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Reads the `csrf_token` cookie (set by the backend on login/register/refresh
 * with `httpOnly: false`) and forwards it as `x-csrf-token` on every request.
 * Backend CsrfGuard requires header+cookie to match on auth/refresh and any
 * other CSRF-protected route.
 */
function readCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const token = readCsrfTokenFromCookie();
  if (!token) return next(req);
  return next(req.clone({ setHeaders: { 'x-csrf-token': token } }));
};
