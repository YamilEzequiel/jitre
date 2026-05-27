import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { WorkspaceContact } from './chat-api.service';

function hashHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

function initialsFromName(name: string): string {
  const parts = name.split(/[\s._@-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function shortId(id: string, len = 8): string {
  return id ? id.slice(0, len) : '';
}

@Injectable({ providedIn: 'root' })
export class WorkspaceMemberStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly _members = signal<WorkspaceContact[]>([]);
  private readonly _loading = signal(false);
  private readonly _loadedWorkspaceId = signal<string | null>(null);

  readonly members = this._members.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly byId = computed<Record<string, WorkspaceContact>>(() => {
    const map: Record<string, WorkspaceContact> = {};
    for (const m of this._members()) map[m.userId] = m;
    return map;
  });

  constructor() {
    effect(() => {
      const workspace = this.auth.currentWorkspace();
      if (!workspace) {
        this._members.set([]);
        this._loadedWorkspaceId.set(null);
        return;
      }
      if (this._loadedWorkspaceId() === workspace.id) return;
      void this.load(workspace.id);
    });
  }

  async load(workspaceId: string): Promise<void> {
    this._loading.set(true);
    try {
      const list = await firstValueFrom(
        this.http.get<WorkspaceContact[]>(`/api/v1/workspaces/${workspaceId}/members`),
      );
      this._members.set(list ?? []);
      this._loadedWorkspaceId.set(workspaceId);
    } catch {
      this._members.set([]);
      this._loadedWorkspaceId.set(null);
    } finally {
      this._loading.set(false);
    }
  }

  async refresh(): Promise<void> {
    const workspace = this.auth.currentWorkspace();
    if (workspace) await this.load(workspace.id);
  }

  memberFor(userId: string | null | undefined): WorkspaceContact | null {
    if (!userId) return null;
    return this.byId()[userId] ?? null;
  }

  displayNameFor(userId: string | null | undefined, fallback?: string): string {
    if (!userId) return fallback ?? '';
    const member = this.byId()[userId];
    if (member?.displayName) return member.displayName;
    return fallback ?? shortId(userId);
  }

  initialsFor(userId: string | null | undefined): string {
    if (!userId) return '??';
    const member = this.byId()[userId];
    const source = member?.displayName || member?.email || userId;
    return initialsFromName(source);
  }

  avatarColorFor(userId: string | null | undefined): string {
    if (!userId) return 'hsl(220, 10%, 60%)';
    return `hsl(${hashHue(userId)}, 65%, 45%)`;
  }

  /**
   * Resolves the display label for a DM channel whose name follows the
   * `dm:<userA>:<userB>` convention. Returns the "other" member's displayName
   * when known, falling back to a short id or the raw channel name.
   */
  dmTitleFor(channelName: string, currentUserId: string): string {
    if (!channelName?.startsWith('dm:')) return channelName || 'Direct message';
    const parts = channelName.slice(3).split(':');
    if (parts.length !== 2) return channelName;
    const [a, b] = parts;
    const other = a === currentUserId ? b : b === currentUserId ? a : a;
    return this.displayNameFor(other, channelName);
  }
}
