import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { RealtimeEvent } from '@jitre/shared';
import { AuthService } from '../auth/auth.service';
import { TaskStore } from '../../stores/task.store';
import { ProjectStore } from '../../stores/project.store';
import { NotificationStore } from '../../stores/notification.store';

const SOCKET_URL = '/';

@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly taskStore = inject(TaskStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly notificationStore = inject(NotificationStore);

  private _socket: Socket | null = null;

  private readonly _connected = signal<boolean>(false);
  readonly connected = this._connected.asReadonly();

  connect(): void {
    if (this._socket) {
      this._socket.disconnect();
    }

    const token = this.auth.getAccessToken();
    this._socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });

    this._socket.on('connect', () => this._connected.set(true));
    this._socket.on('disconnect', () => this._connected.set(false));

    this._bindEventBridge();
  }

  disconnect(): void {
    if (this._socket) {
      this._socket.disconnect();
      this._connected.set(false);
    }
  }

  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  private _bindEventBridge(): void {
    if (!this._socket) return;

    // Task events
    this._socket.on(RealtimeEvent.TASK_CREATED, (p: { taskId: string }) => {
      this.taskStore.applyEvent({ type: 'created', id: p.taskId });
    });
    this._socket.on(RealtimeEvent.TASK_UPDATED, (p: { taskId: string }) => {
      this.taskStore.applyEvent({ type: 'updated', id: p.taskId });
    });
    this._socket.on(RealtimeEvent.TASK_STATUS_CHANGED, (p: { taskId: string }) => {
      this.taskStore.applyEvent({ type: 'updated', id: p.taskId });
    });
    this._socket.on(RealtimeEvent.TASK_ASSIGNED, (p: { taskId: string }) => {
      this.taskStore.applyEvent({ type: 'updated', id: p.taskId });
    });
    this._socket.on(RealtimeEvent.TASK_UNASSIGNED, (p: { taskId: string }) => {
      this.taskStore.applyEvent({ type: 'updated', id: p.taskId });
    });
    this._socket.on(RealtimeEvent.TASK_COMPLETED, (p: { taskId: string }) => {
      this.taskStore.applyEvent({ type: 'updated', id: p.taskId });
    });
    this._socket.on(RealtimeEvent.TASK_DELETED, (p: { taskId: string }) => {
      this.taskStore.applyEvent({ type: 'deleted', id: p.taskId });
    });
    this._socket.on(RealtimeEvent.TASK_REORDERED, (p: { taskId: string }) => {
      this.taskStore.applyEvent({ type: 'updated', id: p.taskId });
    });

    // Project events
    this._socket.on(RealtimeEvent.PROJECT_CREATED, (p: { projectId: string }) => {
      this.projectStore.applyEvent({ type: 'created', id: p.projectId });
    });
    this._socket.on(RealtimeEvent.PROJECT_UPDATED, (p: { projectId: string }) => {
      this.projectStore.applyEvent({ type: 'updated', id: p.projectId });
    });
    this._socket.on(RealtimeEvent.PROJECT_ARCHIVED, (p: { projectId: string }) => {
      this.projectStore.applyEvent({ type: 'updated', id: p.projectId });
    });
    this._socket.on(RealtimeEvent.PROJECT_MEMBER_ADDED, (p: { projectId: string }) => {
      this.projectStore.applyEvent({ type: 'updated', id: p.projectId });
    });
    this._socket.on(RealtimeEvent.PROJECT_MEMBER_REMOVED, (p: { projectId: string }) => {
      this.projectStore.applyEvent({ type: 'updated', id: p.projectId });
    });

    // Comment events — bridge as task updates (comment change implies task updated)
    this._socket.on(RealtimeEvent.COMMENT_CREATED, (p: { taskId: string }) => {
      this.taskStore.applyEvent({ type: 'updated', id: p.taskId });
    });
    this._socket.on(RealtimeEvent.COMMENT_UPDATED, (p: { taskId: string }) => {
      this.taskStore.applyEvent({ type: 'updated', id: p.taskId });
    });
    this._socket.on(RealtimeEvent.COMMENT_DELETED, (p: { taskId: string }) => {
      this.taskStore.applyEvent({ type: 'updated', id: p.taskId });
    });

    // Notification events
    this._socket.on(RealtimeEvent.NOTIFICATION_CREATED, (p: { notificationId: string }) => {
      this.notificationStore.applyEvent({ type: 'created', id: p.notificationId });
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
