import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { PATH_METADATA } from '@nestjs/common/constants';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<string>() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.record(req, res, start, context),
        error: () => this.record(req, res, start, context),
      }),
    );
  }

  private record(
    req: Request,
    res: Response,
    start: bigint,
    context: ExecutionContext,
  ): void {
    if (req.path?.endsWith('/metrics')) return;
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    this.metrics.recordRequest({
      method: req.method,
      route: this.resolveRoute(req, context),
      status: res.statusCode,
      durationSeconds,
    });
  }

  private resolveRoute(req: Request, context: ExecutionContext): string {
    const handler = context.getHandler();
    const cls = context.getClass();
    const handlerPath = this.reflector.get<string>(PATH_METADATA, handler) ?? '';
    const classPath = this.reflector.get<string>(PATH_METADATA, cls) ?? '';
    const joined = [classPath, handlerPath]
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/');
    if (joined) return joined.startsWith('/') ? joined : `/${joined}`;
    return req.route?.path ?? req.path ?? 'unknown';
  }
}
