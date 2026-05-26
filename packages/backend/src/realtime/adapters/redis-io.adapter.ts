import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

export interface RedisAdapterConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  async connectToRedis(config: RedisAdapterConfig): Promise<void> {
    const pubClient = this._createRedisClient(config);
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  /** @internal — overridable in tests */
  _createRedisClient(config: RedisAdapterConfig): Redis {
    return new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: 'socketio:',
    });
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      (server as { adapter: (a: unknown) => void }).adapter(
        this.adapterConstructor,
      );
    }
    return server;
  }
}
