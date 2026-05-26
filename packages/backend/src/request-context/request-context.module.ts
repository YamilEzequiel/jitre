import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import { RequestContextService, RC_KEYS } from './request-context.service';

/**
 * Global wrapping of the AsyncLocalStorage store. `ClsModule.forRoot` with
 * `middleware.mount: true` makes every Express request automatically carry a
 * fresh CLS context. We seed the requestId here (re-using `x-request-id` if
 * the client sent one, generating one otherwise).
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req) =>
          (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
        setup: (cls, req) => {
          cls.set(
            RC_KEYS.REQUEST_ID,
            (req.headers['x-request-id'] as string | undefined) ?? cls.getId(),
          );
        },
      },
    }),
  ],
  providers: [RequestContextService],
  exports: [RequestContextService, ClsModule],
})
export class RequestContextModule {}
