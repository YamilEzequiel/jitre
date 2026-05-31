import * as vscode from 'vscode';
import { io, Socket } from 'socket.io-client';
import { JitreClient } from '../api/client';

export interface RealtimeEvents {
  onTaskChanged: (payload: { taskId?: string; projectId?: string }) => void;
  onProjectChanged: (payload: { projectId?: string }) => void;
  onCommentChanged: (payload: { contextId?: string }) => void;
  onNotificationCreated: (payload: { id?: string }) => void;
}

const TASK_EVENTS = [
  'task.created',
  'task.updated',
  'task.status_changed',
  'task.assigned',
  'task.unassigned',
  'task.completed',
  'task.deleted',
  'task.reordered',
];

const PROJECT_EVENTS = [
  'project.created',
  'project.updated',
  'project.archived',
  'project.member.added',
  'project.member.removed',
];

const COMMENT_EVENTS = ['comment.created', 'comment.updated', 'comment.deleted'];

export class JitreRealtime {
  private socket: Socket | null = null;
  private handlers: Partial<RealtimeEvents> = {};
  private connectedRecently = false;
  private reconnectAttempt = 0;
  private readonly statusBar: vscode.StatusBarItem;

  constructor(private readonly client: JitreClient) {
    this.statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      97,
    );
  }

  dispose(): void {
    this.disconnect();
    this.statusBar.dispose();
  }

  on(handlers: Partial<RealtimeEvents>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  connect(): void {
    this.disconnect();
    const accessToken = this.client.getAccessToken();
    const workspace = this.client.getWorkspace();
    if (!accessToken || !workspace) {
      return;
    }
    const base = this.resolveSocketBase();
    if (!base) return;

    this.updateStatus('connecting');

    const socket = io(base, {
      path: '/ws',
      transports: ['websocket'],
      auth: { token: accessToken, workspaceId: workspace.id },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      timeout: 10_000,
    });

    socket.on('connect', () => {
      this.connectedRecently = true;
      this.reconnectAttempt = 0;
      this.updateStatus('connected');
    });

    socket.on('disconnect', (reason) => {
      this.updateStatus('disconnected', reason);
    });

    socket.io.on('reconnect_attempt', (n) => {
      this.reconnectAttempt = n;
      this.updateStatus('reconnecting');
    });

    socket.on('connect_error', (err) => {
      this.updateStatus('error', err.message);
    });

    for (const ev of TASK_EVENTS) {
      socket.on(ev, (payload: { taskId?: string; projectId?: string }) => {
        this.handlers.onTaskChanged?.(payload ?? {});
      });
    }
    for (const ev of PROJECT_EVENTS) {
      socket.on(ev, (payload: { projectId?: string }) => {
        this.handlers.onProjectChanged?.(payload ?? {});
      });
    }
    for (const ev of COMMENT_EVENTS) {
      socket.on(ev, (payload: { contextId?: string }) => {
        this.handlers.onCommentChanged?.(payload ?? {});
      });
    }
    socket.on('notification.created', (payload: { id?: string }) => {
      this.handlers.onNotificationCreated?.(payload ?? {});
    });

    this.socket = socket;
  }

  disconnect(): void {
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.statusBar.hide();
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  private resolveSocketBase(): string | null {
    const cfg = vscode.workspace.getConfiguration('jitre');
    const raw = (cfg.get<string>('apiUrl') ?? '').trim();
    if (!raw) return null;
    // socket.io connects to the HTTP origin, then upgrades. http://localhost:3000 OK.
    return raw.replace(/\/+$/, '');
  }

  private updateStatus(
    state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error',
    detail?: string,
  ): void {
    switch (state) {
      case 'connecting':
        this.statusBar.text = '$(sync~spin) Jitre live';
        this.statusBar.tooltip = 'Connecting realtime channel';
        this.statusBar.show();
        return;
      case 'reconnecting':
        this.statusBar.text = `$(sync~spin) Jitre live (retry ${this.reconnectAttempt})`;
        this.statusBar.tooltip = 'Reconnecting realtime channel';
        this.statusBar.show();
        return;
      case 'connected':
        this.statusBar.text = '$(broadcast) Jitre live';
        this.statusBar.tooltip = 'Realtime channel connected';
        this.statusBar.show();
        return;
      case 'disconnected':
        if (!this.connectedRecently) {
          this.statusBar.hide();
          return;
        }
        this.statusBar.text = '$(debug-disconnect) Jitre offline';
        this.statusBar.tooltip = detail ?? 'Realtime channel disconnected';
        this.statusBar.show();
        return;
      case 'error':
        this.statusBar.text = '$(warning) Jitre live · error';
        this.statusBar.tooltip = detail ?? 'Realtime error';
        this.statusBar.show();
        return;
    }
  }
}
