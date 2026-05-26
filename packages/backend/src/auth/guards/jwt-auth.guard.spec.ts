import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const makeContext = (isPublicHandler: boolean, isPublicClass: boolean) => {
  const handler = {};
  const classRef = {};
  Reflect.defineMetadata(IS_PUBLIC_KEY, isPublicHandler || undefined, handler);
  Reflect.defineMetadata(IS_PUBLIC_KEY, isPublicClass || undefined, classRef);

  return {
    getHandler: () => handler,
    getClass: () => classRef,
    switchToHttp: () => ({
      getRequest: () => ({ headers: {}, cookies: {} }),
    }),
  } as unknown as ExecutionContext;
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  it('should return true for @Public() routes without calling super', async () => {
    const ctx = makeContext(true, false);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should call super.canActivate for non-public routes', async () => {
    const ctx = makeContext(false, false);
    const superSpy = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockResolvedValueOnce(true);

    const result = await guard.canActivate(ctx);
    expect(superSpy).toHaveBeenCalled();
    expect(result).toBe(true);
    superSpy.mockRestore();
  });

  it('should propagate UnauthorizedException from super for invalid tokens', async () => {
    const ctx = makeContext(false, false);
    jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockRejectedValueOnce(new UnauthorizedException());

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
