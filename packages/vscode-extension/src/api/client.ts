import * as vscode from 'vscode';
import type {
  ActiveTimer,
  AuthUser,
  AuthWorkspace,
  Comment,
  LoginResponse,
  NotificationItem,
  Paginated,
  ProjectStatus,
  ProjectSummary,
  RefreshResponse,
  SearchEntityType,
  SearchResult,
  TaskPriority,
  TaskSummary,
  WorkspaceMember,
  WorkspaceSummary,
} from './types';

const REFRESH_COOKIE_KEY = 'jitre.refreshCookie';
const CSRF_COOKIE_KEY = 'jitre.csrfCookie';

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

function toApiError(message: string, status?: number, code?: string): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  err.code = code;
  return err;
}

interface CookieJar {
  refreshToken: string | null;
  csrfToken: string | null;
}

export class JitreClient {
  private accessToken: string | null = null;
  private currentUser: AuthUser | null = null;
  private currentWorkspace: AuthWorkspace | null = null;
  private cookies: CookieJar = { refreshToken: null, csrfToken: null };
  private refreshInFlight: Promise<void> | null = null;
  private readonly onChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onChange.event;

  constructor(private readonly secrets: vscode.SecretStorage) {}

  // ─── lifecycle ────────────────────────────────────────────────────────────

  async hydrate(): Promise<void> {
    const refresh = await this.secrets.get(REFRESH_COOKIE_KEY);
    const csrf = await this.secrets.get(CSRF_COOKIE_KEY);
    this.cookies = {
      refreshToken: refresh ?? null,
      csrfToken: csrf ?? null,
    };
    if (refresh && csrf) {
      try {
        await this.refresh();
      } catch {
        // Stale session — clear silently. UI stays signed-out.
        await this.clearSession();
      }
    }
  }

  isSignedIn(): boolean {
    return this.accessToken !== null && this.currentUser !== null;
  }

  getUser(): AuthUser | null {
    return this.currentUser;
  }

  getWorkspace(): AuthWorkspace | null {
    return this.currentWorkspace;
  }

  setWorkspace(workspace: AuthWorkspace): void {
    this.currentWorkspace = workspace;
    this.onChange.fire();
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  // ─── config ───────────────────────────────────────────────────────────────

  private get baseUrl(): string {
    const cfg = vscode.workspace.getConfiguration('jitre');
    const raw = (cfg.get<string>('apiUrl') ?? 'http://localhost:3000').trim();
    return raw.replace(/\/+$/, '');
  }

  private get apiPrefix(): string {
    const cfg = vscode.workspace.getConfiguration('jitre');
    const version = (cfg.get<string>('apiVersion') ?? '1').trim();
    return `/api/v${version}`;
  }

  webBaseUrl(): string {
    const cfg = vscode.workspace.getConfiguration('jitre');
    const web = (cfg.get<string>('webBaseUrl') ?? '').trim();
    return (web || this.baseUrl).replace(/\/+$/, '');
  }

  // ─── auth ─────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<void> {
    const res = await this.rawFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'content-type': 'application/json' },
      skipAuth: true,
    });
    await this.absorbAuthResponse<LoginResponse>(res, false);
    this.onChange.fire();
  }

  async refresh(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = (async () => {
      if (!this.cookies.refreshToken || !this.cookies.csrfToken) {
        throw toApiError('No saved session.', 401, 'NO_SESSION');
      }
      const res = await this.rawFetch('/auth/refresh', {
        method: 'POST',
        body: '{}',
        headers: { 'content-type': 'application/json' },
        skipAuth: true,
        includeCsrf: true,
      });
      await this.absorbAuthResponse<RefreshResponse>(res, true);
    })().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  async logout(): Promise<void> {
    if (this.accessToken) {
      try {
        await this.rawFetch('/auth/logout', {
          method: 'POST',
          body: '{}',
          headers: { 'content-type': 'application/json' },
        });
      } catch {
        // best effort
      }
    }
    await this.clearSession();
  }

  private async absorbAuthResponse<T extends LoginResponse | RefreshResponse>(
    res: Response,
    allowMissingWorkspace: boolean,
  ): Promise<void> {
    if (!res.ok) {
      const body = await res.text();
      throw toApiError(
        this.errorMessage(body, res.status),
        res.status,
        this.errorCode(body),
      );
    }
    this.readSetCookies(res);
    const data = (await res.json()) as T;
    this.accessToken = data.accessToken;
    this.currentUser = data.user;
    if (data.workspace) {
      this.currentWorkspace = data.workspace as AuthWorkspace;
    } else if (!allowMissingWorkspace) {
      throw toApiError('No workspace in auth response.', 500);
    }
    await this.persistCookies();
  }

  private async clearSession(): Promise<void> {
    this.accessToken = null;
    this.currentUser = null;
    this.currentWorkspace = null;
    this.cookies = { refreshToken: null, csrfToken: null };
    await this.secrets.delete(REFRESH_COOKIE_KEY);
    await this.secrets.delete(CSRF_COOKIE_KEY);
    this.onChange.fire();
  }

  private async persistCookies(): Promise<void> {
    if (this.cookies.refreshToken) {
      await this.secrets.store(REFRESH_COOKIE_KEY, this.cookies.refreshToken);
    }
    if (this.cookies.csrfToken) {
      await this.secrets.store(CSRF_COOKIE_KEY, this.cookies.csrfToken);
    }
  }

  // ─── HTTP plumbing ────────────────────────────────────────────────────────

  private buildCookieHeader(): string | null {
    const parts: string[] = [];
    if (this.cookies.refreshToken) {
      parts.push(`refresh_token=${this.cookies.refreshToken}`);
    }
    if (this.cookies.csrfToken) {
      parts.push(`csrf_token=${this.cookies.csrfToken}`);
    }
    return parts.length > 0 ? parts.join('; ') : null;
  }

  private readSetCookies(res: Response): void {
    // Node fetch exposes set-cookie as a single string with comma separation
    // but headers.getSetCookie() returns an array when available (Node 19+).
    type WithGetSetCookie = {
      getSetCookie?: () => string[];
    };
    const headers = res.headers as unknown as WithGetSetCookie;
    const setCookies: string[] = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : this.splitSetCookieHeader(res.headers.get('set-cookie'));
    for (const raw of setCookies) {
      const eq = raw.indexOf('=');
      if (eq < 0) continue;
      const name = raw.slice(0, eq).trim();
      const value = raw.slice(eq + 1).split(';')[0].trim();
      if (name === 'refresh_token') this.cookies.refreshToken = value;
      else if (name === 'csrf_token') this.cookies.csrfToken = value;
    }
  }

  private splitSetCookieHeader(raw: string | null): string[] {
    if (!raw) return [];
    // Best-effort split on ", " that isn't inside an Expires=... date.
    const out: string[] = [];
    let buf = '';
    let i = 0;
    while (i < raw.length) {
      const c = raw[i];
      if (c === ',' && this.isCookieBoundary(raw, i)) {
        out.push(buf.trim());
        buf = '';
        i++;
        while (raw[i] === ' ') i++;
      } else {
        buf += c;
        i++;
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  private isCookieBoundary(raw: string, idx: number): boolean {
    // A comma is a boundary unless it's followed by a weekday name (Expires).
    const tail = raw.slice(idx + 1, idx + 10).toLowerCase().trim();
    return !/^(?:mon|tue|wed|thu|fri|sat|sun)/.test(tail);
  }

  private errorMessage(body: string, status: number): string {
    try {
      const json = JSON.parse(body) as { message?: string; error?: string };
      if (Array.isArray(json.message)) return json.message.join(', ');
      return json.message ?? json.error ?? `HTTP ${status}`;
    } catch {
      return body || `HTTP ${status}`;
    }
  }

  private errorCode(body: string): string | undefined {
    try {
      const json = JSON.parse(body) as { code?: string; error?: string };
      return json.code ?? json.error;
    } catch {
      return undefined;
    }
  }

  private async rawFetch(
    path: string,
    init: RequestInit & { skipAuth?: boolean; includeCsrf?: boolean } = {},
  ): Promise<Response> {
    const url = `${this.baseUrl}${this.apiPrefix}${path}`;
    const headers = new Headers(init.headers);
    if (!headers.has('accept')) headers.set('accept', 'application/json');
    if (!init.skipAuth && this.accessToken) {
      headers.set('authorization', `Bearer ${this.accessToken}`);
    }
    if (this.currentWorkspace && !headers.has('x-workspace-id')) {
      headers.set('x-workspace-id', this.currentWorkspace.id);
    }
    if (init.includeCsrf && this.cookies.csrfToken) {
      headers.set('x-csrf-token', this.cookies.csrfToken);
    }
    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headers.set('cookie', cookieHeader);
    }
    return fetch(url, {
      ...init,
      headers,
    });
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    attempt = 0,
  ): Promise<T> {
    const res = await this.rawFetch(path, init);
    if (res.status === 401 && attempt === 0 && this.cookies.refreshToken) {
      try {
        await this.refresh();
      } catch {
        await this.clearSession();
        throw toApiError('Session expired.', 401, 'SESSION_EXPIRED');
      }
      return this.request<T>(path, init, attempt + 1);
    }
    if (!res.ok) {
      const body = await res.text();
      throw toApiError(
        this.errorMessage(body, res.status),
        res.status,
        this.errorCode(body),
      );
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  // ─── endpoints ────────────────────────────────────────────────────────────

  async listWorkspaces(): Promise<WorkspaceSummary[]> {
    return this.request('/workspaces');
  }

  async listProjects(): Promise<ProjectSummary[]> {
    return this.request('/projects');
  }

  async getProject(id: string): Promise<ProjectSummary> {
    return this.request(`/projects/${id}`);
  }

  async listProjectStatuses(projectId: string): Promise<ProjectStatus[]> {
    return this.request(`/projects/${projectId}/statuses`);
  }

  async listProjectTasks(
    projectId: string,
    filter?: { statusId?: string; assigneeUserId?: string; q?: string },
  ): Promise<TaskSummary[]> {
    const qs = new URLSearchParams();
    if (filter?.statusId) qs.set('statusId', filter.statusId);
    if (filter?.assigneeUserId) qs.set('assigneeUserId', filter.assigneeUserId);
    if (filter?.q) qs.set('q', filter.q);
    const query = qs.toString();
    const path = `/projects/${projectId}/tasks${query ? `?${query}` : ''}`;
    return this.request(path);
  }

  async getTask(taskId: string): Promise<TaskSummary> {
    return this.request(`/tasks/${taskId}`);
  }

  async createTask(
    projectId: string,
    input: {
      title: string;
      description?: string;
      priority?: TaskPriority;
      statusId?: string;
      assigneeUserIds?: string[];
      dueDate?: string;
      parentTaskId?: string;
    },
  ): Promise<TaskSummary> {
    const statusId = input.statusId ?? (await this.resolveDefaultStatusId(projectId));
    return this.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ ...input, statusId }),
      headers: { 'content-type': 'application/json' },
    });
  }

  private async resolveDefaultStatusId(projectId: string): Promise<string> {
    const statuses = await this.listProjectStatuses(projectId);
    if (!Array.isArray(statuses) || statuses.length === 0) {
      throw new Error(
        `Project ${projectId} has no statuses configured. Create at least one status before creating tasks.`,
      );
    }
    const explicit = statuses.find((s) => s.isDefault === true);
    if (explicit) return explicit.id;
    const sorted = [...statuses].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    return sorted[0].id;
  }

  async suggestSubtasks(
    taskId: string,
    maxSuggestions = 5,
  ): Promise<{ subtasks: Array<{ title: string; description?: string }> }> {
    return this.request(`/ai/tasks/${taskId}/suggest-subtasks`, {
      method: 'POST',
      body: JSON.stringify({ maxSuggestions }),
      headers: { 'content-type': 'application/json' },
    });
  }

  async describeTask(
    taskId: string,
    opts?: { tone?: 'technical' | 'casual'; applyToTask?: boolean },
  ): Promise<{ description: string; applied: boolean }> {
    return this.request(`/ai/tasks/${taskId}/describe`, {
      method: 'POST',
      body: JSON.stringify(opts ?? {}),
      headers: { 'content-type': 'application/json' },
    });
  }

  async uploadAttachment(
    context: 'task' | 'project' | 'comment',
    contextId: string,
    file: { name: string; mimeType: string; bytes: Uint8Array },
  ): Promise<unknown> {
    const form = new FormData();
    // Copy into a fresh ArrayBuffer to satisfy DOM Blob's `BlobPart` type —
    // VS Code's Uint8Array generic resolves to `ArrayBufferLike` which TS
    // refuses to widen to `ArrayBuffer`.
    const ab = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(ab).set(file.bytes);
    const blob = new Blob([ab], { type: file.mimeType });
    form.append('file', blob, file.name);
    form.append('context', context);
    form.append('contextId', contextId);
    return this.request('/attachments', {
      method: 'POST',
      body: form,
      // Let fetch set content-type with boundary.
    });
  }

  async updateTask(
    projectId: string,
    taskId: string,
    patch: Partial<{
      title: string;
      description: string;
      priority: TaskPriority;
      dueDate: string | null;
      assigneeUserIds: string[];
    }>,
  ): Promise<TaskSummary> {
    return this.request(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
      headers: { 'content-type': 'application/json' },
    });
  }

  async changeTaskStatus(
    projectId: string,
    taskId: string,
    statusId: string,
  ): Promise<TaskSummary> {
    return this.request(`/projects/${projectId}/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ statusId }),
      headers: { 'content-type': 'application/json' },
    });
  }

  async completeTask(projectId: string, taskId: string): Promise<TaskSummary> {
    return this.request(`/projects/${projectId}/tasks/${taskId}/complete`, {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    });
  }

  async assignTask(
    projectId: string,
    taskId: string,
    userId: string,
  ): Promise<unknown> {
    return this.request(`/projects/${projectId}/tasks/${taskId}/assignees`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
      headers: { 'content-type': 'application/json' },
    });
  }

  async unassignTask(
    projectId: string,
    taskId: string,
    userId: string,
  ): Promise<void> {
    await this.request(
      `/projects/${projectId}/tasks/${taskId}/assignees/${userId}`,
      { method: 'DELETE' },
    );
  }

  async listComments(taskId: string): Promise<Paginated<Comment>> {
    const qs = new URLSearchParams({
      contextType: 'task',
      contextId: taskId,
      page: '1',
      limit: '100',
    });
    return this.request(`/comments?${qs.toString()}`);
  }

  async addComment(taskId: string, body: string): Promise<Comment> {
    return this.request('/comments', {
      method: 'POST',
      body: JSON.stringify({ contextType: 'task', contextId: taskId, body }),
      headers: {
        'content-type': 'application/json',
        'x-jitre-source': 'extension',
      },
    });
  }

  async listNotifications(unreadOnly = false): Promise<Paginated<NotificationItem>> {
    const qs = new URLSearchParams({
      page: '1',
      pageSize: '50',
      ...(unreadOnly ? { unreadOnly: 'true' } : {}),
    });
    return this.request(`/notifications?${qs.toString()}`);
  }

  async markNotificationRead(id: string): Promise<unknown> {
    return this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead(): Promise<{ updated: number }> {
    return this.request('/notifications/read-all', { method: 'PATCH' });
  }

  async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.request(`/workspaces/${workspaceId}/members`);
  }

  async getActiveTimer(): Promise<ActiveTimer | null> {
    return this.request<ActiveTimer | null>('/time-entries/timer/active');
  }

  async startTimer(
    taskId: string,
    description?: string,
    billable?: boolean,
  ): Promise<ActiveTimer> {
    return this.request('/time-entries/timer/start', {
      method: 'POST',
      body: JSON.stringify({
        taskId,
        ...(description ? { description } : {}),
        ...(billable !== undefined ? { billable } : {}),
      }),
      headers: { 'content-type': 'application/json' },
    });
  }

  async stopTimer(): Promise<unknown> {
    return this.request('/time-entries/timer/stop', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    });
  }

  async search(
    q: string,
    type?: SearchEntityType,
    pageSize = 20,
  ): Promise<SearchResult> {
    const qs = new URLSearchParams({ q, page: '1', pageSize: String(pageSize) });
    if (type) qs.set('type', type);
    return this.request(`/search?${qs.toString()}`);
  }
}
