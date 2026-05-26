import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClsServiceManager } from 'nestjs-cls';
import type { IProblemDetail } from '@jitre/shared';
import { RC_KEYS } from '../../request-context/request-context.service';

interface NormalizedError {
  status: number;
  title: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

/**
 * Global error filter. Converts any thrown error into an RFC 7807-style
 * Problem Details payload, attaches the current requestId, and logs at the
 * appropriate level (warn for 4xx, error for 5xx).
 *
 * NestJS validation failures (`BadRequestException` with the standard
 * `{ message: string[] }` payload) get flattened into a per-field `errors`
 * map so the frontend can show field-level errors directly.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const normalized = this.normalize(exception);
    const requestId = this.resolveRequestId(request);

    const body: IProblemDetail = {
      type: this.typeUri(normalized.status),
      title: normalized.title,
      status: normalized.status,
      detail: normalized.detail,
      instance: request.originalUrl,
      requestId,
      errors: normalized.errors,
    };

    if (normalized.status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} → ${normalized.status}: ${normalized.title}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.originalUrl} → ${normalized.status}: ${normalized.title}`,
      );
    }

    response
      .status(normalized.status)
      .setHeader('Content-Type', 'application/problem+json')
      .json(body);
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return { status, title: response };
      }

      if (this.isObject(response)) {
        const message = response.message;
        const title =
          (typeof response.error === 'string' && response.error) ||
          exception.name ||
          'Error';

        if (Array.isArray(message)) {
          return {
            status,
            title,
            detail: message.join('; '),
            errors: this.flattenValidationMessages(message),
          };
        }

        return {
          status,
          title,
          detail: typeof message === 'string' ? message : undefined,
        };
      }

      return { status, title: exception.name };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: 'Internal Server Error',
      detail: exception instanceof Error ? exception.message : 'Unknown error',
    };
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private flattenValidationMessages(
    messages: unknown[],
  ): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const raw of messages) {
      if (typeof raw !== 'string') continue;
      const [field, ...rest] = raw.split(' ');
      const key = field?.length ? field : '_';
      const msg = rest.length ? rest.join(' ') : raw;
      (out[key] ??= []).push(msg);
    }
    return out;
  }

  private typeUri(status: number): string {
    return `https://datatracker.ietf.org/doc/html/rfc9110#status.${status}`;
  }

  private resolveRequestId(request: Request): string | undefined {
    try {
      const cls = ClsServiceManager.getClsService();
      return cls.get<string>(RC_KEYS.REQUEST_ID);
    } catch {
      return (
        (request.headers['x-request-id'] as string | undefined) ?? undefined
      );
    }
  }
}
