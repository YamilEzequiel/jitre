import { Logger } from '@nestjs/common';
import { WsBackpressureMiddleware } from './ws-backpressure.middleware';

// Directly instantiate: new WsBackpressureMiddleware(redis, logger)
// The @Inject decorator is transparent at runtime.

const makeRedis = (incrResult: number | Error, expireResult: unknown = 1) => ({
  incr: jest
    .fn()
    .mockImplementation(() =>
      incrResult instanceof Error
        ? Promise.reject(incrResult)
        : Promise.resolve(incrResult),
    ),
  expire: jest.fn().mockResolvedValue(expireResult),
});

const mockLogger = {
  warn: jest.fn(),
  log: jest.fn(),
} as unknown as Logger;

const LIMIT = 50; // default WS_MAX_EVENTS_PER_SOCKET_SEC

describe('WsBackpressureMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['WS_MAX_EVENTS_PER_SOCKET_SEC'];
  });

  describe('checkAndConsume()', () => {
    it('returns true when count is under limit', async () => {
      const redis = makeRedis(10);
      const mw = new WsBackpressureMiddleware(redis as never, mockLogger);
      const result = await mw.checkAndConsume('socket-1');
      expect(result).toBe(true);
    });

    it('returns true when count equals limit', async () => {
      const redis = makeRedis(LIMIT);
      const mw = new WsBackpressureMiddleware(redis as never, mockLogger);
      const result = await mw.checkAndConsume('socket-1');
      expect(result).toBe(true);
    });

    it('returns false when count exceeds limit', async () => {
      const redis = makeRedis(LIMIT + 1);
      const mw = new WsBackpressureMiddleware(redis as never, mockLogger);
      const result = await mw.checkAndConsume('socket-1');
      expect(result).toBe(false);
    });

    it('logs a warn on overrun', async () => {
      const redis = makeRedis(LIMIT + 5);
      const mw = new WsBackpressureMiddleware(redis as never, mockLogger);
      await mw.checkAndConsume('socket-1');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('falls open (returns true) on Redis error', async () => {
      const redis = makeRedis(new Error('redis down'));
      const mw = new WsBackpressureMiddleware(redis as never, mockLogger);
      const result = await mw.checkAndConsume('socket-1');
      expect(result).toBe(true);
    });

    it('logs warn on Redis error', async () => {
      const redis = makeRedis(new Error('redis down'));
      const mw = new WsBackpressureMiddleware(redis as never, mockLogger);
      await mw.checkAndConsume('socket-1');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('sets TTL via expire() only on first INCR (count === 1)', async () => {
      const redis = makeRedis(1);
      const mw = new WsBackpressureMiddleware(redis as never, mockLogger);
      await mw.checkAndConsume('socket-1');
      expect(redis.expire).toHaveBeenCalledWith(
        expect.stringContaining('socket-1'),
        1,
      );
    });

    it('does NOT set TTL on subsequent INCRs (count > 1)', async () => {
      const redis = makeRedis(5); // count > 1
      const mw = new WsBackpressureMiddleware(redis as never, mockLogger);
      await mw.checkAndConsume('socket-1');
      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('uses socket-specific Redis key', async () => {
      const redis = makeRedis(1);
      const mw = new WsBackpressureMiddleware(redis as never, mockLogger);
      await mw.checkAndConsume('socket-abc');
      expect(redis.incr).toHaveBeenCalledWith(
        expect.stringContaining('socket-abc'),
      );
    });
  });

  describe('sustained overrun disconnect', () => {
    it('increments overrunSeconds on consecutive overruns', async () => {
      const redis = makeRedis(LIMIT + 1);
      const mw = new WsBackpressureMiddleware(redis as never, mockLogger);
      const socket = {
        id: 'sock-1',
        data: { overrunSeconds: 0 },
        disconnect: jest.fn(),
      };

      await mw.checkAndConsumeForSocket('sock-1', socket as never);
      await mw.checkAndConsumeForSocket('sock-1', socket as never);
      expect(socket.data.overrunSeconds).toBe(2);
    });

    it('disconnects socket after >= 3 consecutive overrun seconds', async () => {
      const redis = makeRedis(LIMIT + 1);
      const mw = new WsBackpressureMiddleware(redis as never, mockLogger);
      const socket = {
        id: 'sock-1',
        data: { overrunSeconds: 2 }, // already 2 — next one triggers disconnect
        disconnect: jest.fn(),
      };

      await mw.checkAndConsumeForSocket('sock-1', socket as never);
      expect(socket.disconnect).toHaveBeenCalledWith(true, 'BACKPRESSURE');
    });

    it('resets overrunSeconds to 0 when under limit', async () => {
      const redis = makeRedis(1); // under limit
      const mw = new WsBackpressureMiddleware(redis as never, mockLogger);
      const socket = {
        id: 'sock-1',
        data: { overrunSeconds: 2 },
        disconnect: jest.fn(),
      };

      await mw.checkAndConsumeForSocket('sock-1', socket as never);
      expect(socket.data.overrunSeconds).toBe(0);
    });
  });
});
