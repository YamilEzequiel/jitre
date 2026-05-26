import { RealtimeGateway } from './realtime.gateway';
import { WsException } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { RealtimeEvent } from '@jitre/shared';
import { WsBackpressureMiddleware } from './middleware/ws-backpressure.middleware';

const makeSocket = (overrides: Record<string, unknown> = {}) => ({
  id: 'socket-1',
  data: { userId: 'user-1', workspaceId: 'ws-1', requestId: 'req-1' },
  join: jest.fn().mockResolvedValue(undefined),
  leave: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
  rooms: new Set<string>(['socket-1']),
  ...overrides,
});

const makeMembershipService = (isMember = true) => ({
  findMembership: jest
    .fn()
    .mockResolvedValue(
      isMember ? { projectId: 'p-1', userId: 'user-1' } : null,
    ),
});

const makeBackpressureMiddleware = (allowed = true) => ({
  checkAndConsume: jest.fn().mockResolvedValue(allowed),
  checkAndConsumeForSocket: jest.fn().mockResolvedValue(allowed),
});

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let membershipService: ReturnType<typeof makeMembershipService>;
  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    jest.clearAllMocks();
    membershipService = makeMembershipService();
    // Default: no backpressure middleware (fail-open path)
    gateway = new RealtimeGateway(membershipService as never, mockLogger, null);
  });

  describe('handleConnection', () => {
    it('auto-joins user:<userId> and workspace:<workspaceId> rooms', async () => {
      const socket = makeSocket();
      await gateway.handleConnection(socket as never);

      expect(socket.join).toHaveBeenCalledWith('user:user-1');
      expect(socket.join).toHaveBeenCalledWith('workspace:ws-1');
    });

    it('disconnects when userId is missing from socket.data', async () => {
      const socket = makeSocket({ data: {} });
      await gateway.handleConnection(socket as never);

      expect(socket.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('logs the disconnect without throwing', async () => {
      const socket = makeSocket();
      await expect(
        gateway.handleDisconnect(socket as never),
      ).resolves.toBeUndefined();
    });
  });

  describe('onSubscribeTask', () => {
    it('joins task:<taskId> when user is a project member', async () => {
      const socket = makeSocket();
      await gateway.onSubscribeTask(socket as never, {
        taskId: 'task-1',
        projectId: 'p-1',
      });

      expect(membershipService.findMembership).toHaveBeenCalledWith(
        'p-1',
        'ws-1',
        'user-1',
      );
      expect(socket.join).toHaveBeenCalledWith('task:task-1');
    });

    it('throws WsException FORBIDDEN when user is not a project member', async () => {
      membershipService = makeMembershipService(false);
      gateway = new RealtimeGateway(
        membershipService as never,
        mockLogger,
        null,
      );
      const socket = makeSocket();

      await expect(
        gateway.onSubscribeTask(socket as never, {
          taskId: 'task-1',
          projectId: 'p-1',
        }),
      ).rejects.toBeInstanceOf(WsException);
    });
  });

  describe('onSubscribeProject', () => {
    it('joins project:<projectId> when user is a project member', async () => {
      const socket = makeSocket();
      await gateway.onSubscribeProject(socket as never, { projectId: 'p-1' });

      expect(socket.join).toHaveBeenCalledWith('project:p-1');
    });

    it('throws WsException FORBIDDEN when user is not a project member', async () => {
      membershipService = makeMembershipService(false);
      gateway = new RealtimeGateway(
        membershipService as never,
        mockLogger,
        null,
      );
      const socket = makeSocket();

      await expect(
        gateway.onSubscribeProject(socket as never, { projectId: 'p-1' }),
      ).rejects.toBeInstanceOf(WsException);
    });
  });

  describe('onUnsubscribe', () => {
    it('leaves the specified room without auth check', async () => {
      const socket = makeSocket();
      await gateway.onUnsubscribe(socket as never, { room: 'project:p-1' });

      expect(socket.leave).toHaveBeenCalledWith('project:p-1');
    });
  });

  describe('emitToRoom', () => {
    it('calls server.to(room).emit(event, payload) when no backpressure middleware', () => {
      const toChain = { emit: jest.fn() };
      const mockServer = { to: jest.fn().mockReturnValue(toChain) };
      gateway.server = mockServer as never;

      const payload = { taskId: 't-1', projectId: 'p-1', workspaceId: 'ws-1' };
      gateway.emitToRoom('project:p-1', RealtimeEvent.TASK_CREATED, payload);

      expect(mockServer.to).toHaveBeenCalledWith('project:p-1');
      expect(toChain.emit).toHaveBeenCalledWith('task.created', payload);
    });
  });

  // ── S1: WS_MAX_ROOMS_PER_SOCKET subscription quota ────────────────────────

  describe('S1 — subscription quota (WS_MAX_ROOMS_PER_SOCKET)', () => {
    const makeQuotaSocket = (roomCount = 0) => ({
      id: 'socket-q',
      data: {
        userId: 'user-1',
        workspaceId: 'ws-1',
        requestId: 'req-1',
        roomCount,
      },
      join: jest.fn().mockImplementation(async function (this: {
        data: { roomCount: number };
      }) {
        // simulate successful join
      }),
      leave: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      rooms: new Set<string>(['socket-q']),
    });

    it('throws WsException SUBSCRIPTION_QUOTA on 101st subscribe when cap=100', async () => {
      const socket = makeQuotaSocket(100); // already at cap
      await expect(
        gateway.onSubscribeTask(socket as never, {
          taskId: 'task-1',
          projectId: 'p-1',
        }),
      ).rejects.toBeInstanceOf(WsException);
    });

    it('allows subscribe when roomCount < cap', async () => {
      const socket = makeQuotaSocket(50); // under cap
      await expect(
        gateway.onSubscribeTask(socket as never, {
          taskId: 'task-1',
          projectId: 'p-1',
        }),
      ).resolves.not.toThrow();
    });

    it('increments roomCount on successful subscribe', async () => {
      const socket = makeQuotaSocket(5);
      await gateway.onSubscribeTask(socket as never, {
        taskId: 'task-1',
        projectId: 'p-1',
      });
      expect((socket.data as { roomCount: number }).roomCount).toBe(6);
    });

    it('decrements roomCount on unsubscribe when socket was in room', async () => {
      const socket = makeQuotaSocket(5);
      socket.rooms.add('task:task-1'); // pre-add room
      await gateway.onUnsubscribe(socket as never, { room: 'task:task-1' });
      expect((socket.data as { roomCount: number }).roomCount).toBe(4);
    });

    it('does NOT go below 0 on unsubscribe (Math.max guard)', async () => {
      const socket = makeQuotaSocket(0);
      socket.rooms.add('task:task-1');
      await gateway.onUnsubscribe(socket as never, { room: 'task:task-1' });
      expect((socket.data as { roomCount: number }).roomCount).toBe(0);
    });

    it('leaveRoomTracked decrements counter', async () => {
      const socket = makeQuotaSocket(3);
      socket.rooms.add('project:p-kick');
      gateway.leaveRoomTracked(socket as never, 'project:p-kick');
      expect((socket.data as { roomCount: number }).roomCount).toBe(2);
    });
  });

  // ── S2: WsBackpressureMiddleware wiring in emitToRoom ─────────────────────

  describe('S2 — backpressure middleware wiring in emitToRoom', () => {
    it('calls checkAndConsume with the room key before emitting', async () => {
      const backpressure = makeBackpressureMiddleware(true);
      gateway = new RealtimeGateway(
        membershipService as never,
        mockLogger,
        backpressure as unknown as WsBackpressureMiddleware,
      );

      const toChain = { emit: jest.fn() };
      const mockServer = { to: jest.fn().mockReturnValue(toChain) };
      gateway.server = mockServer as never;

      const payload = { taskId: 't-1', projectId: 'p-1', workspaceId: 'ws-1' };
      await gateway.emitToRoom(
        'project:p-1',
        RealtimeEvent.TASK_CREATED,
        payload,
      );

      expect(backpressure.checkAndConsume).toHaveBeenCalledWith('project:p-1');
    });

    it('emits when checkAndConsume returns true (allowed)', async () => {
      const backpressure = makeBackpressureMiddleware(true);
      gateway = new RealtimeGateway(
        membershipService as never,
        mockLogger,
        backpressure as unknown as WsBackpressureMiddleware,
      );

      const toChain = { emit: jest.fn() };
      const mockServer = { to: jest.fn().mockReturnValue(toChain) };
      gateway.server = mockServer as never;

      const payload = { taskId: 't-1', projectId: 'p-1', workspaceId: 'ws-1' };
      await gateway.emitToRoom(
        'project:p-1',
        RealtimeEvent.TASK_CREATED,
        payload,
      );

      expect(toChain.emit).toHaveBeenCalledWith('task.created', payload);
    });

    it('skips emit and logs warn when checkAndConsume returns false (rate-limited)', async () => {
      const backpressure = makeBackpressureMiddleware(false);
      gateway = new RealtimeGateway(
        membershipService as never,
        mockLogger,
        backpressure as unknown as WsBackpressureMiddleware,
      );

      const toChain = { emit: jest.fn() };
      const mockServer = { to: jest.fn().mockReturnValue(toChain) };
      gateway.server = mockServer as never;

      const payload = { taskId: 't-1', projectId: 'p-1', workspaceId: 'ws-1' };
      await gateway.emitToRoom(
        'project:p-1',
        RealtimeEvent.TASK_CREATED,
        payload,
      );

      expect(toChain.emit).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('emits without calling checkAndConsume when middleware is null (fail-open)', async () => {
      // gateway already created with null backpressure in beforeEach
      const toChain = { emit: jest.fn() };
      const mockServer = { to: jest.fn().mockReturnValue(toChain) };
      gateway.server = mockServer as never;

      const payload = { taskId: 't-1', projectId: 'p-1', workspaceId: 'ws-1' };
      // emitToRoom without backpressure — legacy sync path
      gateway.emitToRoom('project:p-1', RealtimeEvent.TASK_CREATED, payload);

      expect(toChain.emit).toHaveBeenCalled();
    });
  });
});
