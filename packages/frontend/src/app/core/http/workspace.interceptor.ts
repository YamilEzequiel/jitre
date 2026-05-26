import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/**
 * Forwards the active workspace id as `x-workspace-id` on every request.
 * Backend TenancyInterceptor uses this header to scope queries to a workspace
 * and rejects mutations without it.
 *
 * Auth endpoints (login/register/refresh) don't need it — they're public and
 * the tenancy interceptor skips them — but adding the header anyway is
 * harmless, so we just skip when there's no active workspace.
 */
export const workspaceInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const workspace = auth.currentWorkspace();
  if (!workspace?.id) return next(req);
  return next(
    req.clone({ setHeaders: { 'x-workspace-id': workspace.id } }),
  );
};
