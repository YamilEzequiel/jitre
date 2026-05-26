import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ClsServiceManager } from 'nestjs-cls';
import { RC_KEYS } from '../../request-context/request-context.service';

/**
 * Inject the current requestId into a controller method param.
 *
 * @example
 *   handle(@RequestId() requestId: string) { ... }
 */
export const RequestId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    try {
      const cls = ClsServiceManager.getClsService();
      return (
        cls.get<string>(RC_KEYS.REQUEST_ID) ??
        (req.headers['x-request-id'] as string | undefined) ??
        'no-request-id'
      );
    } catch {
      return (
        (req.headers['x-request-id'] as string | undefined) ?? 'no-request-id'
      );
    }
  },
);
