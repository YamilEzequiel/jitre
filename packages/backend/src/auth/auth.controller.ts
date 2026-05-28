import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { SkipTenancy } from './decorators/skip-tenancy.decorator';
import { CsrfGuard } from './guards/csrf.guard';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// CSRF token is readable from JS (httpOnly: false) and must be visible on
// every page so the csrf interceptor can attach it to every request — hence
// path '/' instead of '/api/v1/auth'. document.cookie filters by the page's
// current path, so a restricted path would hide it from /login, /dashboard, etc.
const CSRF_COOKIE_OPTIONS = {
  ...REFRESH_COOKIE_OPTIONS,
  httpOnly: false,
  path: '/',
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: 0,
};

const LEGACY_CSRF_CLEAR_COOKIE_OPTIONS = {
  ...CLEAR_COOKIE_OPTIONS,
  httpOnly: false,
};

@ApiTags('auth')
@Controller('auth')
@SkipTenancy()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Register a new user and create a default workspace',
  })
  @ApiResponse({
    status: 201,
    description: 'User created; refresh_token and csrf_token cookies set.',
  })
  @ApiResponse({ status: 409, description: 'EMAIL_TAKEN' })
  @ApiResponse({ status: 422, description: 'WEAK_PASSWORD' })
  @Post('register')
  @Public()
  // 5 registrations per minute per IP. Account creation is cheap to fire and
  // expensive downstream (workspace seed, AI quotas, email side-effects), so
  // it gets a tighter cap than the global throttler.
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ): Promise<{ user: unknown; workspace: unknown; accessToken: string }> {
    const deviceInfo = { userAgent: req.headers['user-agent'], ip: req.ip };
    const result = await this.authService.register(dto, deviceInfo);

    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.clearCookie('csrf_token', LEGACY_CSRF_CLEAR_COOKIE_OPTIONS);
    res.cookie('csrf_token', result.csrfToken, CSRF_COOKIE_OPTIONS);

    return {
      user: result.user,
      workspace: result.workspace,
      accessToken: result.accessToken,
    };
  }

  @ApiOperation({ summary: 'Authenticate with email + password' })
  @ApiResponse({
    status: 200,
    description: 'Authenticated; refresh_token and csrf_token cookies set.',
  })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS' })
  @ApiResponse({ status: 403, description: 'ACCOUNT_DISABLED' })
  @Post('login')
  @Public()
  // 10 attempts per minute per IP. Throttler ships an IP-based tracker
  // out of the box; this is the explicit guardrail against credential
  // stuffing, layered on top of the global throttler.
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ): Promise<{ user: unknown; workspace: unknown; accessToken: string }> {
    const deviceInfo = { userAgent: req.headers['user-agent'], ip: req.ip };
    const result = await this.authService.login(
      dto.email,
      dto.password,
      deviceInfo,
    );

    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.clearCookie('csrf_token', LEGACY_CSRF_CLEAR_COOKIE_OPTIONS);
    res.cookie('csrf_token', result.csrfToken, CSRF_COOKIE_OPTIONS);

    return {
      user: result.user,
      workspace: result.workspace,
      accessToken: result.accessToken,
    };
  }

  @ApiOperation({
    summary:
      'Rotate refresh token (requires csrf_token cookie + x-csrf-token header)',
  })
  @ApiCookieAuth('refresh')
  @ApiResponse({
    status: 200,
    description: 'New accessToken + rotated refresh_token cookie.',
  })
  @ApiResponse({ status: 401, description: 'TOKEN_REUSE | TOKEN_MISSING' })
  @ApiResponse({ status: 403, description: 'CSRF_MISSING | CSRF_MISMATCH' })
  @Post('refresh')
  @Public()
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ): Promise<{ user: unknown; workspace: unknown; accessToken: string }> {
    const cookies = req.cookies as Record<string, string>;
    const rawToken = cookies?.refresh_token;

    if (!rawToken) {
      throw new UnauthorizedException('TOKEN_MISSING');
    }

    const deviceInfo = { userAgent: req.headers['user-agent'], ip: req.ip };
    const result = await this.authService.refresh(rawToken, deviceInfo);

    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.clearCookie('csrf_token', LEGACY_CSRF_CLEAR_COOKIE_OPTIONS);
    res.cookie('csrf_token', result.csrfToken, CSRF_COOKIE_OPTIONS);

    return {
      user: result.user,
      workspace: result.workspace,
      accessToken: result.accessToken,
    };
  }

  @ApiOperation({ summary: 'Logout current session' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 204,
    description: 'Session revoked; cookies cleared.',
  })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ): Promise<void> {
    const cookies = req.cookies as Record<string, string>;
    const rawToken = cookies?.refresh_token;

    if (rawToken) {
      await this.authService.logoutByToken(rawToken);
    }

    res.clearCookie('refresh_token', CLEAR_COOKIE_OPTIONS);
    res.clearCookie('csrf_token', LEGACY_CSRF_CLEAR_COOKIE_OPTIONS);
    res.clearCookie('csrf_token', { ...CLEAR_COOKIE_OPTIONS, httpOnly: false, path: '/' });
  }

  @ApiOperation({ summary: 'Logout all sessions for the authenticated user' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 204,
    description: 'All sessions revoked; cookies cleared.',
  })
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ): Promise<void> {
    const reqWithUser = req as Request & { user?: { id: string } };
    if (reqWithUser.user?.id) {
      await this.authService.logoutAll(reqWithUser.user.id);
    }

    res.clearCookie('refresh_token', CLEAR_COOKIE_OPTIONS);
    res.clearCookie('csrf_token', LEGACY_CSRF_CLEAR_COOKIE_OPTIONS);
    res.clearCookie('csrf_token', { ...CLEAR_COOKIE_OPTIONS, httpOnly: false, path: '/' });
  }
}
