import { Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ChatGateway } from './chat.gateway';

const makeSocket = (overrides: Record<string, unknown> = {}) => ({
  id: 'socket-1',
  data: { userId: 'user-1', workspaceId: 'ws-1', requestId: 'req-1' },
  join: jest.fn().mockResolvedValue(undefined),
  leave: jest.fn().mockResolvedValue(undefined),
  to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  disconnect: jest.fn(),
  ...overrides,
});

const makeServer = () => {
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  const use = jest.fn();
  return { emit, to, use };
};

const makeChatService = (isMember = true) => ({
  isMember: jest.fn().mockResolvedValue(isMember),
});

const makeJwtMiddleware = () => ({
  use: jest.fn(),
});

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: ReturnType<typeof makeChatService>;
  let jwtMiddleware: ReturnType<typeof makeJwtMiddleware>;
  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    jest.clearAllMocks();
    chatService = makeChatService();
    jwtMiddleware = makeJwtMiddleware();
    gateway = new ChatGateway(
      chatService as never,
      mockLogger,
      jwtMiddleware as never,
    );
  });

  // ── afterInit ───────────────────────────────────────────────────────────

  describe('afterInit()', () => {
    it('installs JWT middleware on the namespace', () => {
      const server = makeServer();
      gateway.afterInit(server as never);
      expect(server.use).toHaveBeenCalled();
    });

    it('tolerates installation errors without throwing', () => {
      const server = { use: jest.fn(() => { throw new Error('boom'); }) };
      expect(() => gateway.afterInit(server as never)).not.toThrow();
    });
  });

  // ── handleConnection / handleDisconnect / presence ──────────────────────

  describe('presence', () => {
    it('joins user + workspace rooms and broadcasts presence=true on first connect', async () => {
      const server = makeServer();
      gateway.server = server as never;
      const socket = makeSocket();

      await gateway.handleConnection(socket as never);

      expect(socket.join).toHaveBeenCalledWith('user:user-1');
      expect(socket.join).toHaveBeenCalledWith('workspace:ws-1');
      expect(server.to).toHaveBeenCalledWith('workspace:ws-1');
      expect(server.emit).toHaveBeenCalledWith('chat:presence', {
        userId: 'user-1',
        online: true,
      });
    });

    it('does not re-broadcast presence on second connect from same user', async () => {
      const server = makeServer();
      gateway.server = server as never;
      await gateway.handleConnection(makeSocket() as never);
      server.emit.mockClear();
      await gateway.handleConnection(makeSocket({ id: 'socket-2' }) as never);
      expect(server.emit).not.toHaveBeenCalledWith(
        'chat:presence',
        expect.objectContaining({ online: true }),
      );
    });

    it('disconnects rejected connection when auth data is missing', async () => {
      const server = makeServer();
      gateway.server = server as never;
      const socket = makeSocket({ data: {} });
      await gateway.handleConnection(socket as never);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('broadcasts presence=false when the last connection drops', async () => {
      const server = makeServer();
      gateway.server = server as never;
      const socket = makeSocket();
      await gateway.handleConnection(socket as never);
      server.emit.mockClear();

      gateway.handleDisconnect(socket as never);
      expect(server.emit).toHaveBeenCalledWith('chat:presence', {
        userId: 'user-1',
        online: false,
      });
      expect(gateway.isOnline('user-1')).toBe(false);
    });

    it('does NOT broadcast presence=false while other connections remain', async () => {
      const server = makeServer();
      gateway.server = server as never;
      await gateway.handleConnection(makeSocket() as never);
      const second = makeSocket({ id: 'socket-2' });
      await gateway.handleConnection(second as never);
      server.emit.mockClear();

      gateway.handleDisconnect(second as never);
      expect(server.emit).not.toHaveBeenCalledWith(
        'chat:presence',
        expect.objectContaining({ online: false }),
      );
      expect(gateway.isOnline('user-1')).toBe(true);
    });

    it('isOnline returns false for unknown users', () => {
      expect(gateway.isOnline('nobody')).toBe(false);
    });
  });

  // ── chat:join / chat:leave ──────────────────────────────────────────────

  describe('onJoin()', () => {
    it('joins channel room when user is a member', async () => {
      const socket = makeSocket();
      await gateway.onJoin(socket as never, { channelId: 'CH1' });
      expect(socket.join).toHaveBeenCalledWith('channel:CH1');
    });

    it('throws WsException FORBIDDEN when not a member', async () => {
      chatService = makeChatService(false);
      gateway = new ChatGateway(
        chatService as never,
        mockLogger,
        jwtMiddleware as never,
      );
      const socket = makeSocket();
      await expect(
        gateway.onJoin(socket as never, { channelId: 'CH1' }),
      ).rejects.toBeInstanceOf(WsException);
    });

    it('throws when channelId is missing', async () => {
      const socket = makeSocket();
      await expect(
        gateway.onJoin(socket as never, {} as never),
      ).rejects.toBeInstanceOf(WsException);
    });
  });

  describe('onLeave()', () => {
    it('leaves the channel room', async () => {
      const socket = makeSocket();
      await gateway.onLeave(socket as never, { channelId: 'CH1' });
      expect(socket.leave).toHaveBeenCalledWith('channel:CH1');
    });
  });

  // ── typing ──────────────────────────────────────────────────────────────

  describe('typing broadcasts', () => {
    it('chat:typing:start broadcasts typing=true to the channel room', async () => {
      const emit = jest.fn();
      const socket = makeSocket({ to: jest.fn().mockReturnValue({ emit }) });
      await gateway.onTypingStart(socket as never, { channelId: 'CH1' });
      expect(socket.to).toHaveBeenCalledWith('channel:CH1');
      expect(emit).toHaveBeenCalledWith('chat:typing', {
        channelId: 'CH1',
        userId: 'user-1',
        typing: true,
      });
    });

    it('chat:typing:stop broadcasts typing=false to the channel room', async () => {
      const emit = jest.fn();
      const socket = makeSocket({ to: jest.fn().mockReturnValue({ emit }) });
      await gateway.onTypingStop(socket as never, { channelId: 'CH1' });
      expect(emit).toHaveBeenCalledWith('chat:typing', {
        channelId: 'CH1',
        userId: 'user-1',
        typing: false,
      });
    });

    it('rejects typing for non-members', async () => {
      chatService = makeChatService(false);
      gateway = new ChatGateway(
        chatService as never,
        mockLogger,
        jwtMiddleware as never,
      );
      const socket = makeSocket();
      await expect(
        gateway.onTypingStart(socket as never, { channelId: 'CH1' }),
      ).rejects.toBeInstanceOf(WsException);
    });
  });

  // ── emitToChannel ───────────────────────────────────────────────────────

  describe('emitToChannel()', () => {
    it('emits the payload to channel:<id> room', () => {
      const server = makeServer();
      gateway.server = server as never;
      gateway.emitToChannel('CH1', 'chat:message:created', { foo: 'bar' });
      expect(server.to).toHaveBeenCalledWith('channel:CH1');
      expect(server.emit).toHaveBeenCalledWith('chat:message:created', {
        foo: 'bar',
      });
    });

    it('is a no-op when server is not yet set', () => {
      // server unset by default unless test assigns it
      expect(() =>
        gateway.emitToChannel('CH1', 'x', { y: 1 }),
      ).not.toThrow();
    });

    it('logs and swallows errors from server.to', () => {
      const server = {
        to: jest.fn(() => {
          throw new Error('explode');
        }),
      };
      gateway.server = server as never;
      expect(() =>
        gateway.emitToChannel('CH1', 'x', { y: 1 }),
      ).not.toThrow();
    });
  });
});
