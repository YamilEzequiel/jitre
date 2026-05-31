/**
 * Tiny HTTP client for the Jitre backend. Same wire-protocol as the
 * VS Code extension's client (Bearer + x-workspace-id + cookie jar +
 * 401-then-refresh) but standalone so the MCP server has no runtime
 * dependency on the extension.
 */

export interface JitreConfig {
  baseUrl: string;
  apiVersion: string;
  email?: string;
  password?: string;
  accessToken?: string;
  refreshCookie?: string;
  csrfCookie?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  slug: string;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  workspace: AuthWorkspace;
}

interface RefreshResponse {
  accessToken: string;
  user: AuthUser;
  workspace: AuthWorkspace | null;
}

export class JitreApiClient {
  private accessToken: string | null = null;
  private user: AuthUser | null = null;
  private workspace: AuthWorkspace | null = null;
  private refreshCookie: string | null = null;
  private csrfCookie: string | null = null;

  constructor(private readonly config: JitreConfig) {
    this.accessToken = config.accessToken ?? null;
    this.refreshCookie = config.refreshCookie ?? null;
    this.csrfCookie = config.csrfCookie ?? null;
  }

  getUser(): AuthUser | null {
    return this.user;
  }

  getWorkspace(): AuthWorkspace | null {
    return this.workspace;
  }

  async ensureSession(): Promise<void> {
    if (this.accessToken && this.workspace) return;
    if (this.refreshCookie && this.csrfCookie) {
      try {
        await this.refresh();
        return;
      } catch {
        // fall through to login
      }
    }
    if (this.config.email && this.config.password) {
      await this.login(this.config.email, this.config.password);
      return;
    }
    throw new Error(
      'No Jitre credentials. Set JITRE_EMAIL+JITRE_PASSWORD env vars or pass refresh/csrf cookies.',
    );
  }

  async login(email: string, password: string): Promise<void> {
    const res = await this.rawFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'content-type': 'application/json' },
      skipAuth: true,
    });
    await this.absorbAuth<LoginResponse>(res, false);
  }

  private async refresh(): Promise<void> {
    const res = await this.rawFetch('/auth/refresh', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
      skipAuth: true,
      includeCsrf: true,
    });
    await this.absorbAuth<RefreshResponse>(res, true);
  }

  private async absorbAuth<T extends LoginResponse | RefreshResponse>(
    res: Response,
    allowMissingWorkspace: boolean,
  ): Promise<void> {
    if (!res.ok) throw await this.toError(res);
    this.readSetCookies(res);
    const data = (await res.json()) as T;
    this.accessToken = data.accessToken;
    this.user = data.user;
    if (data.workspace) {
      this.workspace = data.workspace;
    } else if (!allowMissingWorkspace) {
      throw new Error('No workspace in auth response.');
    }
  }

  private async toError(res: Response): Promise<Error> {
    const body = await res.text();
    try {
      const json = JSON.parse(body) as { message?: string | string[]; error?: string };
      const msg = Array.isArray(json.message)
        ? json.message.join(', ')
        : (json.message ?? json.error ?? `HTTP ${res.status}`);
      return new Error(`${res.status}: ${msg}`);
    } catch {
      return new Error(body || `HTTP ${res.status}`);
    }
  }

  private readSetCookies(res: Response): void {
    const h = res.headers as unknown as { getSetCookie?: () => string[] };
    const raws = typeof h.getSetCookie === 'function'
      ? h.getSetCookie()
      : this.splitSetCookieHeader(res.headers.get('set-cookie'));
    for (const r of raws) {
      const eq = r.indexOf('=');
      if (eq < 0) continue;
      const name = r.slice(0, eq).trim();
      const value = r.slice(eq + 1).split(';')[0].trim();
      if (name === 'refresh_token') this.refreshCookie = value;
      else if (name === 'csrf_token') this.csrfCookie = value;
    }
  }

  private splitSetCookieHeader(raw: string | null): string[] {
    if (!raw) return [];
    const out: string[] = [];
    let buf = '';
    let i = 0;
    while (i < raw.length) {
      const c = raw[i];
      if (c === ',') {
        const tail = raw.slice(i + 1, i + 10).toLowerCase().trim();
        if (!/^(?:mon|tue|wed|thu|fri|sat|sun)/.test(tail)) {
          out.push(buf.trim());
          buf = '';
          i++;
          while (raw[i] === ' ') i++;
          continue;
        }
      }
      buf += c;
      i++;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  private async rawFetch(
    path: string,
    init: RequestInit & { skipAuth?: boolean; includeCsrf?: boolean } = {},
  ): Promise<Response> {
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/api/v${this.config.apiVersion}${path}`;
    const headers = new Headers(init.headers);
    if (!headers.has('accept')) headers.set('accept', 'application/json');
    if (!init.skipAuth && this.accessToken) {
      headers.set('authorization', `Bearer ${this.accessToken}`);
    }
    if (this.workspace && !headers.has('x-workspace-id')) {
      headers.set('x-workspace-id', this.workspace.id);
    }
    if (init.includeCsrf && this.csrfCookie) {
      headers.set('x-csrf-token', this.csrfCookie);
    }
    const cookieParts: string[] = [];
    if (this.refreshCookie) cookieParts.push(`refresh_token=${this.refreshCookie}`);
    if (this.csrfCookie) cookieParts.push(`csrf_token=${this.csrfCookie}`);
    if (cookieParts.length > 0) headers.set('cookie', cookieParts.join('; '));
    return fetch(url, { ...init, headers });
  }

  async request<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    await this.ensureSession();
    const res = await this.rawFetch(path, init);
    if (res.status === 401 && attempt === 0 && this.refreshCookie) {
      try {
        await this.refresh();
      } catch {
        if (this.config.email && this.config.password) {
          await this.login(this.config.email, this.config.password);
        } else {
          throw new Error('Session expired and no credentials configured.');
        }
      }
      return this.request<T>(path, init, attempt + 1);
    }
    if (!res.ok) throw await this.toError(res);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
}
