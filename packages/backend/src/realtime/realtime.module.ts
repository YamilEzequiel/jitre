import { Logger, Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeListener } from './realtime.listener';
import { WsJwtMiddleware } from './middleware/ws-jwt.middleware';
import { RedisIoAdapter } from './adapters/redis-io.adapter';
import {
  WsBackpressureMiddleware,
  WS_REDIS_TOKEN,
} from './middleware/ws-backpressure.middleware';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [forwardRef(() => AuthModule), UserModule, forwardRef(() => ProjectModule)],
  providers: [
    RealtimeGateway,
    RealtimeListener,
    WsJwtMiddleware,
    RedisIoAdapter,
    Logger,
    // S2: Redis client for WsBackpressureMiddleware token bucket
    {
      provide: WS_REDIS_TOKEN,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService): Redis | null => {
        try {
          const redis = cfg.get<{
            host: string;
            port: number;
            password?: string;
          }>('redis');
          return new Redis({
            host: redis?.host ?? 'localhost',
            port: redis?.port ?? 6379,
            password: redis?.password,
            keyPrefix: 'ws:bp:',
            lazyConnect: true,
          });
        } catch {
          // Falls open — backpressure is optional
          return null;
        }
      },
    },
    WsBackpressureMiddleware,
  ],
  exports: [RealtimeGateway, WsJwtMiddleware, RedisIoAdapter],
})
export class RealtimeModule {}
