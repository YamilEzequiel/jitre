import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RealtimeEvent } from '@jitre/shared';

// Mock socket.io-client at module level BEFORE any imports that use it
vi.mock('socket.io-client', () => {
  const listeners: Record<string, Array<(data: unknown) => void>> = {};
  const fakeSocket = {
    connected: false,
    on: vi.fn((event: string, cb: (data: unknown) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    off: vi.fn((event: string, cb: (data: unknown) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(l => l !== cb);
      }
    }),
    _listeners: listeners,
    _trigger: (event: string, data: unknown) => {
      (listeners[event] ?? []).forEach(cb => cb(data));
    },
  };
  return {
    io: vi.fn(() => fakeSocket),
    _fakeSocket: fakeSocket,
  };
});

// Import after mock is set up
import { RealtimeService } from './realtime.service';
import { AuthService } from '../auth/auth.service';
import { TaskStore } from '../../stores/task.store';
import { ProjectStore } from '../../stores/project.store';
import { NotificationStore } from '../../stores/notification.store';
import * as SocketIO from 'socket.io-client';

function getFakeSocket() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (SocketIO as any)._fakeSocket;
}

describe('RealtimeService', () => {
  let service: RealtimeService;
  let authSpy: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    getAccessToken: ReturnType<typeof vi.fn>;
    currentWorkspace: ReturnType<typeof vi.fn>;
  };
  let taskStoreSpy: { applyEvent: ReturnType<typeof vi.fn> };
  let projectStoreSpy: { applyEvent: ReturnType<typeof vi.fn> };
  let notificationStoreSpy: { applyEvent: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Reset fake socket state
    const socket = getFakeSocket();
    socket.connected = false;
    socket.on.mockClear();
    socket.emit.mockClear();
    socket.disconnect.mockClear();
    socket.off.mockClear();
    Object.keys(socket._listeners).forEach(k => delete socket._listeners[k]);
    (SocketIO.io as ReturnType<typeof vi.fn>).mockClear();

    authSpy = {
      isAuthenticated: vi.fn().mockReturnValue(false),
      getAccessToken: vi.fn().mockReturnValue(null),
      currentWorkspace: vi.fn().mockReturnValue(null),
    };
    taskStoreSpy = { applyEvent: vi.fn().mockResolvedValue(undefined) };
    projectStoreSpy = { applyEvent: vi.fn().mockResolvedValue(undefined) };
    notificationStoreSpy = { applyEvent: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        RealtimeService,
        { provide: AuthService, useValue: authSpy },
        { provide: TaskStore, useValue: taskStoreSpy },
        { provide: ProjectStore, useValue: projectStoreSpy },
        { provide: NotificationStore, useValue: notificationStoreSpy },
      ],
    });
    service = TestBed.inject(RealtimeService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('connected() signal starts false', () => {
    expect(service.connected()).toBe(false);
  });

  it('connect() calls io() with JWT in auth handshake', () => {
    authSpy.getAccessToken.mockReturnValue('tok123');
    service.connect();
    expect(SocketIO.io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        auth: expect.objectContaining({ token: 'tok123' }),
      }),
    );
  });

  it('binds listeners for all 17 RealtimeEvent values', () => {
    service.connect();
    const socket = getFakeSocket();
    const registeredEvents = socket.on.mock.calls.map((c: [string]) => c[0]);
    const enumValues = Object.values(RealtimeEvent);
    expect(enumValues).toHaveLength(17);
    for (const ev of enumValues) {
      expect(registeredEvents).toContain(ev);
    }
  });

  it('task event routes to TaskStore.applyEvent', async () => {
    service.connect();
    const socket = getFakeSocket();
    socket._trigger(RealtimeEvent.TASK_UPDATED, { taskId: 't1', projectId: 'p1', workspaceId: 'w1', changed: [] });
    await Promise.resolve(); // flush microtasks
    expect(taskStoreSpy.applyEvent).toHaveBeenCalledWith({ type: 'updated', id: 't1' });
  });

  it('project event routes to ProjectStore.applyEvent', async () => {
    service.connect();
    const socket = getFakeSocket();
    socket._trigger(RealtimeEvent.PROJECT_UPDATED, { projectId: 'p1', workspaceId: 'w1', changed: [] });
    await Promise.resolve();
    expect(projectStoreSpy.applyEvent).toHaveBeenCalledWith({ type: 'updated', id: 'p1' });
  });

  it('notification event routes to NotificationStore.applyEvent', async () => {
    service.connect();
    const socket = getFakeSocket();
    socket._trigger(RealtimeEvent.NOTIFICATION_CREATED, { notificationId: 'n1', workspaceId: 'w1', type: 'mention' });
    await Promise.resolve();
    expect(notificationStoreSpy.applyEvent).toHaveBeenCalledWith({ type: 'created', id: 'n1' });
  });

  it('disconnect() calls socket.disconnect()', () => {
    service.connect();
    service.disconnect();
    const socket = getFakeSocket();
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('reconnect() disconnects then reconnects with fresh token', () => {
    authSpy.getAccessToken.mockReturnValue('newtoken');
    service.connect();
    const callsBefore = (SocketIO.io as ReturnType<typeof vi.fn>).mock.calls.length;
    service.reconnect();
    const callsAfter = (SocketIO.io as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBeGreaterThan(callsBefore);
  });
});
