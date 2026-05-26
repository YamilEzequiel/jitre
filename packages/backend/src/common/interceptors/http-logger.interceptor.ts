import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function iconForStatus(status: number): string {
  if (status >= 500) return '🔴';
  if (status >= 400) return '🟡';
  if (status >= 300) return '🔵';
  return '🟢';
}

function colorForStatus(status: number): string {
  if (status >= 500) return C.red;
  if (status >= 400) return C.yellow;
  if (status >= 300) return C.blue;
  return C.green;
}

const METHOD_COLOR: Record<string, string> = {
  GET: C.cyan,
  POST: C.green,
  PUT: C.yellow,
  PATCH: C.yellow,
  DELETE: C.red,
  OPTIONS: C.gray,
  HEAD: C.gray,
};

function shortReqId(id: unknown): string {
  const s = typeof id === 'string' ? id : '';
  return s ? s.slice(0, 8) : '--------';
}

/**
 * One-line, color-coded HTTP log per request. Emitted on response completion
 * (or on uncaught error) with icon, status, method, URL and duration.
 *
 *   🟢 200  GET    /api/v1/auth/me               12ms  [a1b2c3d4]
 *   🟡 401  POST   /api/v1/auth/login             3ms  [e5f6g7h8]
 *   🔴 500  PATCH  /api/v1/projects/x            87ms  [i9j0k1l2]
 *
 * Skips non-HTTP contexts (WebSocket, RPC).
 */
@Injectable()
export class HttpLoggerInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();

    const http = ctx.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    if (!req?.method) return next.handle();

    const start = process.hrtime.bigint();
    const method = req.method;
    const url = req.originalUrl ?? req.url ?? '';
    const reqId = shortReqId(req.id);

    const write = (status: number): void => {
      const durMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
      const icon = iconForStatus(status);
      const statusColor = colorForStatus(status);
      const methodColor = METHOD_COLOR[method] ?? C.gray;

      const statusStr = `${statusColor}${String(status).padStart(3, ' ')}${C.reset}`;
      const methodStr = `${methodColor}${method.padEnd(6)}${C.reset}`;
      const durStr = `${C.dim}${String(durMs).padStart(4, ' ')}ms${C.reset}`;
      const idStr = `${C.gray}[${reqId}]${C.reset}`;

      process.stdout.write(
        `${icon}  ${statusStr}  ${methodStr} ${url}  ${durStr}  ${idStr}\n`,
      );
    };

    return next.handle().pipe(
      tap(() => write(http.getResponse<Response>().statusCode)),
      catchError((err: { status?: number; statusCode?: number }) => {
        write(err?.status ?? err?.statusCode ?? 500);
        return throwError(() => err);
      }),
    );
  }
}
