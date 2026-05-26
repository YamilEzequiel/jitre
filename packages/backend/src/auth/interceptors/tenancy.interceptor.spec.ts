import {
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { TenancyInterceptor } from './tenancy.interceptor';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_TENANCY_KEY } from '../decorators/skip-tenancy.decorator';
import { WorkspaceRole } from '@jitre/shared';

const mockWsService = {
  findMembership: jest.fn(),
};

const mockRcService = {
  getUserId: jest.fn(),
  setWorkspaceId: jest.fn(),
  setRole: jest.fn(),
  setAbility: jest.fn(),
};

const mockAbilityFactory = {
  createForUserInWorkspace: jest.fn(),
};

const VALID_UUID = '00000000-0000-0000-0000-000000000001';
const WORKSPACE_UUID = '00000000-0000-0000-0000-000000000002';

const makeCtx = (
  headers: Record<string, string>,
  metaPublic?: boolean,
  metaSkip?: boolean,
) => {
  const handler = {};
  const classRef = {};
  if (metaPublic) Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
  if (metaSkip) Reflect.defineMetadata(SKIP_TENANCY_KEY, true, handler);

  return {
    getHandler: () => handler,
    getClass: () => classRef,
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
};

const makeNext = () => ({ handle: () => of('response') });

describe('TenancyInterceptor', () => {
  let interceptor: TenancyInterceptor;
  let reflector: Reflector;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = new Reflector();
    interceptor = new TenancyInterceptor(
      reflector,
      mockWsService as never,
      mockRcService as never,
      mockAbilityFactory,
    );
  });

  it('should skip tenancy check for @Public() routes', (done) => {
    const ctx = makeCtx({}, true, false);
    interceptor.intercept(ctx, makeNext()).subscribe({
      next: (v) => {
        expect(v).toBe('response');
        expect(mockWsService.findMembership).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should skip tenancy check for @SkipTenancy() routes', (done) => {
    const ctx = makeCtx({}, false, true);
    interceptor.intercept(ctx, makeNext()).subscribe({
      next: (v) => {
        expect(v).toBe('response');
        expect(mockWsService.findMembership).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should throw BadRequestException when x-workspace-id header is missing', async () => {
    mockRcService.getUserId.mockReturnValue(VALID_UUID);
    const ctx = makeCtx({});
    let error: Error | undefined;
    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeNext()).subscribe({
        error: (e) => {
          error = e;
          resolve();
        },
        next: () => resolve(),
      });
    });
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe(
      'WORKSPACE_HEADER_REQUIRED',
    );
  });

  it('should throw BadRequestException when x-workspace-id is not a valid UUID', async () => {
    mockRcService.getUserId.mockReturnValue(VALID_UUID);
    const ctx = makeCtx({ 'x-workspace-id': 'not-a-uuid' });
    let error: Error | undefined;
    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeNext()).subscribe({
        error: (e) => {
          error = e;
          resolve();
        },
        next: () => resolve(),
      });
    });
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe(
      'WORKSPACE_HEADER_INVALID',
    );
  });

  it('should throw ForbiddenException when user has no membership in workspace', async () => {
    mockRcService.getUserId.mockReturnValue(VALID_UUID);
    mockWsService.findMembership.mockResolvedValue(null);
    const ctx = makeCtx({ 'x-workspace-id': WORKSPACE_UUID });
    let error: Error | undefined;
    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeNext()).subscribe({
        error: (e) => {
          error = e;
          resolve();
        },
        next: () => resolve(),
      });
    });
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).message).toBe('TENANT_MISMATCH');
  });

  it('should populate RequestContext and build ability on valid membership', (done) => {
    mockRcService.getUserId.mockReturnValue(VALID_UUID);
    const membership = {
      userId: VALID_UUID,
      workspaceId: WORKSPACE_UUID,
      role: WorkspaceRole.MEMBER,
    };
    mockWsService.findMembership.mockResolvedValue(membership);
    const mockAbility = { can: jest.fn() };
    mockAbilityFactory.createForUserInWorkspace.mockReturnValue(mockAbility);

    const ctx = makeCtx({ 'x-workspace-id': WORKSPACE_UUID });
    interceptor.intercept(ctx, makeNext()).subscribe({
      next: () => {
        expect(mockRcService.setWorkspaceId).toHaveBeenCalledWith(
          WORKSPACE_UUID,
        );
        expect(mockRcService.setRole).toHaveBeenCalledWith(
          WorkspaceRole.MEMBER,
        );
        expect(
          mockAbilityFactory.createForUserInWorkspace,
        ).toHaveBeenCalledWith(
          VALID_UUID,
          WORKSPACE_UUID,
          WorkspaceRole.MEMBER,
        );
        expect(mockRcService.setAbility).toHaveBeenCalledWith(mockAbility);
        done();
      },
    });
  });
});
