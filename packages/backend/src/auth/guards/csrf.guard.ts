import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      cookies: Record<string, string>;
      headers: Record<string, string | undefined>;
    }>();

    const headerToken = request.headers?.['x-csrf-token'];
    const cookieTokens = this.readCsrfCookieTokens(
      request.headers?.cookie,
      request.cookies?.csrf_token,
    );

    if (cookieTokens.length === 0 || !headerToken) {
      throw new ForbiddenException('CSRF_MISSING');
    }

    const headerBuf = Buffer.from(headerToken);
    const match = cookieTokens.some((cookieToken) => {
      const cookieBuf = Buffer.from(cookieToken);
      return (
        cookieBuf.length === headerBuf.length &&
        timingSafeEqual(cookieBuf, headerBuf)
      );
    });
    if (!match) {
      throw new ForbiddenException('CSRF_MISMATCH');
    }

    return true;
  }

  /**
   * During the CSRF cookie path migration, clients may temporarily send both
   * `/api/v1/auth` and `/` cookies. cookie-parser preserves only one value,
   * so validate against every raw cookie value until refresh removes legacy.
   */
  private readCsrfCookieTokens(
    rawCookieHeader: string | undefined,
    parsedToken: string | undefined,
  ): string[] {
    const tokens = (rawCookieHeader ?? '')
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.startsWith('csrf_token='))
      .map((part) => this.decodeCookieValue(part.slice('csrf_token='.length)));

    return tokens.length > 0 ? tokens : parsedToken ? [parsedToken] : [];
  }

  private decodeCookieValue(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
}
