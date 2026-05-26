import { Injectable, computed, inject, isDevMode, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AuthUser,
  AuthWorkspace,
  LoginCredentials,
  LoginResponse,
  RefreshResponse,
  RegisterCredentials,
} from './auth.types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _accessToken = signal<string | null>(null);
  private readonly _currentUser = signal<AuthUser | null>(null);
  private readonly _currentWorkspace = signal<AuthWorkspace | null>(null);

  /** Single in-flight refresh promise to deduplicate concurrent calls */
  private _refreshPromise: Promise<void> | null = null;

  readonly currentUser = this._currentUser.asReadonly();
  readonly currentWorkspace = this._currentWorkspace.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  async register(credentials: RegisterCredentials): Promise<void> {
    await firstValueFrom(this.http.post('/api/v1/auth/register', credentials));
  }

  async requestReset(email: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/v1/auth/request-password-reset', { email }));
  }

  async login(credentials: LoginCredentials): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>('/api/v1/auth/login', credentials),
    );
    this._accessToken.set(response.accessToken);
    this._currentUser.set(response.user);
    this._currentWorkspace.set(response.workspace);
  }

  async refresh(): Promise<void> {
    if (this._refreshPromise) {
      return this._refreshPromise;
    }
    this._refreshPromise = firstValueFrom(
      this.http.post<RefreshResponse>('/api/v1/auth/refresh', {}),
    )
      .then(response => {
        this._accessToken.set(response.accessToken);
        this._currentUser.set(response.user);
        this._currentWorkspace.set(response.workspace);
      })
      .finally(() => {
        this._refreshPromise = null;
      });
    return this._refreshPromise;
  }

  logout(): void {
    this._accessToken.set(null);
    this._currentUser.set(null);
    this._currentWorkspace.set(null);
    // Best-effort backend logout; don't await
    firstValueFrom(this.http.post('/api/v1/auth/logout', {})).catch(() => undefined);
  }

  async hydrate(): Promise<void> {
    if (this.tryActivateDevMock()) return;
    // Skip the refresh round-trip when there is no candidate session — the
    // backend CsrfGuard would 403 anyway, and the noise pollutes the network
    // panel on every cold boot. csrf_token is readable; refresh_token is
    // HttpOnly but always set alongside it, so its presence is a fair proxy.
    if (!this.hasCsrfCookie()) return;
    try {
      await this.refresh();
    } catch {
      // Stale/invalid session — leave signals null and let the guard redirect.
    }
  }

  private hasCsrfCookie(): boolean {
    if (typeof document === 'undefined') return false;
    return /(?:^|;\s*)csrf_token=/.test(document.cookie);
  }

  /**
   * Dev-only: short-circuits auth with a fake user/workspace so the protected
   * shell (dashboard, projects, settings, analytics) can be navigated without
   * a running backend. Toggle from the browser console:
   *   localStorage.setItem('jitre:dev-mock', '1'); location.reload();
   *   localStorage.removeItem('jitre:dev-mock');  location.reload();
   * Gated on isDevMode() — no-op in production builds.
   */
  private tryActivateDevMock(): boolean {
    if (!isDevMode()) return false;
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem('jitre:dev-mock') !== '1') return false;
    this._accessToken.set('dev-mock-token');
    this._currentUser.set({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'demo@jitre.local',
      displayName: 'Demo User',
      role: 'admin',
    });
    this._currentWorkspace.set({
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Demo Workspace',
      slug: 'demo',
      role: 'owner',
    });
    return true;
  }

  getAccessToken(): string | null {
    return this._accessToken();
  }

  switchWorkspace(workspace: AuthWorkspace): void {
    this._currentWorkspace.set(workspace);
  }
}
