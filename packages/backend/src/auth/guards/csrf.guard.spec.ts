import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

const makeCtx = (
  cookies: Record<string, string>,
  headers: Record<string, string>,
) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ cookies, headers }),
    }),
  }) as unknown as ExecutionContext;

describe('CsrfGuard', () => {
  let guard: CsrfGuard;

  beforeEach(() => {
    guard = new CsrfGuard();
  });

  it('should allow request when csrf cookie matches x-csrf-token header', () => {
    const token = 'abc123def456abc123def456abc123de';
    const ctx = makeCtx({ csrf_token: token }, { 'x-csrf-token': token });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow the readable csrf cookie during legacy path migration', () => {
    const legacyToken = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const readableToken = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const ctx = makeCtx(
      { csrf_token: legacyToken },
      {
        cookie: `csrf_token=${legacyToken}; csrf_token=${readableToken}`,
        'x-csrf-token': readableToken,
      },
    );

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException with CSRF_MISSING when csrf_token cookie is absent', () => {
    const ctx = makeCtx({}, { 'x-csrf-token': 'some-token' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('CSRF_MISSING');
  });

  it('should throw ForbiddenException with CSRF_MISSING when x-csrf-token header is absent', () => {
    const ctx = makeCtx({ csrf_token: 'some-token' }, {});
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('CSRF_MISSING');
  });

  it('should throw ForbiddenException with CSRF_MISMATCH when tokens differ', () => {
    const ctx = makeCtx(
      { csrf_token: 'aaaaaaaaaaaaaaaa' },
      { 'x-csrf-token': 'bbbbbbbbbbbbbbbb' },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('CSRF_MISMATCH');
  });

  it('should throw ForbiddenException with CSRF_MISMATCH when tokens have different lengths', () => {
    const ctx = makeCtx(
      { csrf_token: 'short' },
      { 'x-csrf-token': 'much-longer-token-value-here' },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
