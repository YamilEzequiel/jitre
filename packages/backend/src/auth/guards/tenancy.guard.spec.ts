import {
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenancyGuard } from './tenancy.guard';
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

describe('TenancyGuard', () => {
  let guard: TenancyGuard;
  let reflector: Reflector;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = new Reflector();
    guard = new TenancyGuard(
      reflector,
      mockWsService as never,
      mockRcService as never,
      mockAbilityFactory as never,
    );
  });

  it('should skip tenancy check for @Public() routes', async () => {
    const ctx = makeCtx({}, true, false);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockWsService.findMembership).not.toHaveBeenCalled();
  });

  it('should skip tenancy check for @SkipTenancy() routes', async () => {
    const ctx = makeCtx({}, false, true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockWsService.findMembership).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException when x-workspace-id header is missing', async () => {
    mockRcService.getUserId.mockReturnValue(VALID_UUID);
    const ctx = makeCtx({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      message: 'WORKSPACE_HEADER_REQUIRED',
    });
  });

  it('should throw BadRequestException when x-workspace-id is not a valid UUID', async () => {
    mockRcService.getUserId.mockReturnValue(VALID_UUID);
    const ctx = makeCtx({ 'x-workspace-id': 'not-a-uuid' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      message: 'WORKSPACE_HEADER_INVALID',
    });
  });

  it('should throw ForbiddenException when user has no membership in workspace', async () => {
    mockRcService.getUserId.mockReturnValue(VALID_UUID);
    mockWsService.findMembership.mockResolvedValue(null);
    const ctx = makeCtx({ 'x-workspace-id': WORKSPACE_UUID });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      message: 'TENANT_MISMATCH',
    });
  });

  it('should populate RequestContext and build ability on valid membership', async () => {
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
    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    expect(mockRcService.setWorkspaceId).toHaveBeenCalledWith(WORKSPACE_UUID);
    expect(mockRcService.setRole).toHaveBeenCalledWith(WorkspaceRole.MEMBER);
    expect(mockAbilityFactory.createForUserInWorkspace).toHaveBeenCalledWith(
      VALID_UUID,
      WORKSPACE_UUID,
      WorkspaceRole.MEMBER,
    );
    expect(mockRcService.setAbility).toHaveBeenCalledWith(mockAbility);
  });
});
