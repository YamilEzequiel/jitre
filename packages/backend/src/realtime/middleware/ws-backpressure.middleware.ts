import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import type { Socket } from 'socket.io';

/** Token used to inject the shared Redis client in the Realtime context */
export const WS_REDIS_TOKEN = Symbol('WS_REDIS_TOKEN');

const SUSTAINED_OVERRUN_THRESHOLD = 3;

@Injectable()
export class WsBackpressureMiddleware {
  constructor(
    @Optional() @Inject(WS_REDIS_TOKEN) private readonly redis: Redis | null,
    private readonly logger: Logger,
  ) {}

  private get limit(): number {
    const raw = process.env['WS_MAX_EVENTS_PER_SOCKET_SEC'];
    const parsed = raw ? parseInt(raw, 10) : 50;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
  }

  /**
   * Check rate limit for a given socketId.
   * Returns true if emit is allowed, false if over limit.
   * Falls open on Redis error or when Redis is unavailable (R6 — never hard-fail realtime).
   */
  async checkAndConsume(socketId: string): Promise<boolean> {
    if (!this.redis) return true; // fall open if no Redis

    const key = `ws:bucket:${socketId}`;
    const limit = this.limit;
    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, 1);
      }
      if (count > limit) {
        this.logger.warn({
          event: 'ws.backpressure.drop',
          socketId,
          count,
          limit,
        });
        return false;
      }
      return true;
    } catch (err) {
      // Falls open per R6 — never hard-fail realtime
      this.logger.warn({
        event: 'ws.backpressure.redis_error',
        socketId,
        err: (err as Error).message,
      });
      return true;
    }
  }

  /**
   * Extended check that also manages sustained overrun state per socket.
   * Used by RealtimeGateway.emitToRoom for per-socket backpressure.
   */
  async checkAndConsumeForSocket(
    socketId: string,
    socket: Socket & { data: { overrunSeconds?: number } },
  ): Promise<boolean> {
    const allowed = await this.checkAndConsume(socketId);
    if (!allowed) {
      const overrunSeconds = (socket.data.overrunSeconds ?? 0) + 1;
      socket.data.overrunSeconds = overrunSeconds;
      if (overrunSeconds >= SUSTAINED_OVERRUN_THRESHOLD) {
        (socket.disconnect as (close: boolean, reason?: string) => void)(
          true,
          'BACKPRESSURE',
        );
      }
      return false;
    }
    // Reset sustained counter on successful emit
    socket.data.overrunSeconds = 0;
    return true;
  }
}
