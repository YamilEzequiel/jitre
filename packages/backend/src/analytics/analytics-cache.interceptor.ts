import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Adds Cache-Control: public, max-age=300, stale-while-revalidate=60
 * to every 200 response from analytics endpoints.
 *
 * Per design §5 (ADR-4): no in-process cache in Fase 8; HTTP cache only.
 */
@Injectable()
export class AnalyticsCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        res.setHeader(
          'Cache-Control',
          'public, max-age=300, stale-while-revalidate=60',
        );
      }),
    );
  }
}
