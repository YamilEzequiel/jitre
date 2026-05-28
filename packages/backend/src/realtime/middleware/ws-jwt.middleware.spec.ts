import { WsJwtMiddleware } from './ws-jwt.middleware';
import { WsException } from '@nestjs/websockets';

const makeSocket = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'socket-1',
    handshake: {
      auth: {},
      headers: {},
    },
    data: {},
    ...overrides,
  }) as unknown as Parameters<WsJwtMiddleware['use']>[0];

describe('WsJwtMiddleware', () => {
  let middleware: WsJwtMiddleware;
  const mockJwtService = { verifyAsync: jest.fn() };
  const mockUserService = { findById: jest.fn() };
  const mockLogger = { warn: jest.fn(), log: jest.fn(), debug: jest.fn() };
  const originalSecret = process.env.JWT_ACCESS_SECRET;

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'test-secret-for-ws-jwt-middleware-spec';
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_ACCESS_SECRET;
    } else {
      process.env.JWT_ACCESS_SECRET = originalSecret;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = new WsJwtMiddleware(
      mockJwtService as never,
      mockUserService as never,
      mockLogger as never,
    );
  });

  describe('valid token', () => {
    it('populates socket.data.userId, workspaceId, requestId and calls next()', async () => {
      const socket = makeSocket({
        handshake: {
          auth: { token: 'valid-token', workspaceId: undefined },
          headers: {},
        },
        data: {},
      });

      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        activeWorkspaceId: 'ws-1',
      });
      mockUserService.findById.mockResolvedValue({
        id: 'user-1',
        deletedAt: null,
      });

      const next = jest.fn();
      await middleware.use(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect((socket as unknown as Record<string, unknown>).data).toMatchObject(
        {
          userId: 'user-1',
          workspaceId: 'ws-1',
        },
      );
      expect(
        (socket as unknown as Record<string, unknown>).data as Record<
          string,
          unknown
        >,
      ).toHaveProperty('requestId');
    });

    it('falls back to handshake.auth.workspaceId when jwt has no activeWorkspaceId', async () => {
      const socket = makeSocket({
        handshake: {
          auth: { token: 'valid-token', workspaceId: 'ws-fallback' },
          headers: {},
        },
        data: {},
      });

      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      mockUserService.findById.mockResolvedValue({
        id: 'user-1',
        deletedAt: null,
      });

      const next = jest.fn();
      await middleware.use(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect(
        (socket as unknown as Record<string, Record<string, unknown>>).data
          .workspaceId,
      ).toBe('ws-fallback');
    });
  });

  describe('missing token', () => {
    it('calls next(WsException UNAUTHENTICATED) when no token is present', async () => {
      const socket = makeSocket();
      const next = jest.fn();
      await middleware.use(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(WsException));
      const err = next.mock.calls[0][0] as WsException;
      expect(err.getError()).toContain('UNAUTHENTICATED');
    });

    it('reads token from Authorization header (Bearer scheme)', async () => {
      const socket = makeSocket({
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer header-token' },
        },
        data: {},
      });

      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        activeWorkspaceId: 'ws-1',
      });
      mockUserService.findById.mockResolvedValue({
        id: 'user-1',
        deletedAt: null,
      });

      const next = jest.fn();
      await middleware.use(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        'header-token',
        expect.objectContaining({ secret: expect.any(String) }),
      );
    });
  });

  describe('expired / invalid token', () => {
    it('calls next(WsException UNAUTHENTICATED) when verifyAsync throws', async () => {
      const socket = makeSocket({
        handshake: { auth: { token: 'expired-token' }, headers: {} },
        data: {},
      });
      mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      const next = jest.fn();
      await middleware.use(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(WsException));
      const err = next.mock.calls[0][0] as WsException;
      expect(err.getError()).toContain('UNAUTHENTICATED');
    });
  });

  describe('deleted user', () => {
    it('calls next(WsException UNAUTHENTICATED) when user.deletedAt is set', async () => {
      const socket = makeSocket({
        handshake: { auth: { token: 'some-token' }, headers: {} },
        data: {},
      });
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-deleted',
        activeWorkspaceId: 'ws-1',
      });
      mockUserService.findById.mockResolvedValue({
        id: 'user-deleted',
        deletedAt: new Date(),
      });

      const next = jest.fn();
      await middleware.use(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(WsException));
    });
  });

  describe('missing workspaceId', () => {
    it('calls next(WsException WORKSPACE_REQUIRED) when workspace cannot be resolved', async () => {
      const socket = makeSocket({
        handshake: { auth: { token: 'valid-token' }, headers: {} },
        data: {},
      });
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' }); // no activeWorkspaceId
      mockUserService.findById.mockResolvedValue({
        id: 'user-1',
        deletedAt: null,
      });

      const next = jest.fn();
      await middleware.use(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(WsException));
      const err = next.mock.calls[0][0] as WsException;
      expect(err.getError()).toContain('WORKSPACE_REQUIRED');
    });
  });
});
