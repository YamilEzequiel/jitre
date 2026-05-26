import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleGuard } from './role.guard';
import { REQUIRE_ROLE_KEY } from '../decorators/require-role.decorator';
import { WorkspaceRole } from '@jitre/shared';

const mockRcService = {
  getRole: jest.fn(),
};

const makeCtx = (requiredRole?: WorkspaceRole) => {
  const handler = {};
  if (requiredRole)
    Reflect.defineMetadata(REQUIRE_ROLE_KEY, requiredRole, handler);
  return {
    getHandler: () => handler,
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let reflector: Reflector;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = new Reflector();
    guard = new RoleGuard(reflector, mockRcService as never);
  });

  it('should pass when no role is required', () => {
    const ctx = makeCtx();
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should pass when user role meets the required role (ADMIN >= MEMBER)', () => {
    mockRcService.getRole.mockReturnValue(WorkspaceRole.ADMIN);
    const ctx = makeCtx(WorkspaceRole.MEMBER);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should pass when user role exactly matches required role', () => {
    mockRcService.getRole.mockReturnValue(WorkspaceRole.ADMIN);
    const ctx = makeCtx(WorkspaceRole.ADMIN);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user role is below required', () => {
    mockRcService.getRole.mockReturnValue(WorkspaceRole.GUEST);
    const ctx = makeCtx(WorkspaceRole.ADMIN);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('INSUFFICIENT_ROLE');
  });

  it('should throw ForbiddenException when user has no role but role is required', () => {
    mockRcService.getRole.mockReturnValue(null);
    const ctx = makeCtx(WorkspaceRole.MEMBER);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
