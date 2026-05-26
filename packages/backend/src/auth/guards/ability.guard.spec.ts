import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityGuard } from './ability.guard';
import { REQUIRE_ABILITY_KEY } from '../decorators/require-ability.decorator';
import type { AppAbility } from '../../request-context/request-context.service';
import { ProjectRole, WorkspaceRole } from '@jitre/shared';

const mockRcService = {
  getAbility: jest.fn(),
  getUserId: jest.fn(),
  setWorkspaceId: jest.fn(),
  setRole: jest.fn(),
  setAbility: jest.fn(),
};

const makeCtx = (
  abilityFn?: (ability: AppAbility) => boolean,
  request: Record<string, unknown> = {},
) => {
  const handler = {};
  if (abilityFn)
    Reflect.defineMetadata(REQUIRE_ABILITY_KEY, abilityFn, handler);
  return {
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
};

describe('AbilityGuard', () => {
  let guard: AbilityGuard;
  let reflector: Reflector;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = new Reflector();
    guard = new AbilityGuard(reflector, mockRcService as never);
  });

  it('should pass when no ability rule is defined', async () => {
    const ctx = makeCtx();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('should pass when ability rule evaluates to true', async () => {
    const mockAbility = {
      can: jest.fn().mockReturnValue(true),
    } as unknown as AppAbility;
    mockRcService.getAbility.mockReturnValue(mockAbility);
    const ctx = makeCtx((ability) => ability.can('read', 'Workspace'));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('should throw ForbiddenException when ability rule evaluates to false', async () => {
    const mockAbility = {
      can: jest.fn().mockReturnValue(false),
    } as unknown as AppAbility;
    mockRcService.getAbility.mockReturnValue(mockAbility);
    const ctx = makeCtx((ability) => ability.can('transfer', 'Workspace'));
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('ABILITY_DENIED');
  });

  it('should throw ForbiddenException when ability is not set in context', async () => {
    mockRcService.getAbility.mockReturnValue(null);
    const ctx = makeCtx((ability) => ability.can('read', 'Workspace'));
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('hydrates workspace ability before tenancy interceptor runs', async () => {
    const ability = { can: jest.fn().mockReturnValue(true) } as unknown as AppAbility;
    const workspaceService = {
      findMembership: jest.fn().mockResolvedValue({ role: WorkspaceRole.MEMBER }),
    };
    const abilityFactory = {
      createForUserInWorkspace: jest.fn().mockReturnValue(ability),
    };
    mockRcService.getAbility.mockReturnValue(null);
    mockRcService.getUserId.mockReturnValue('u1');
    guard = new AbilityGuard(
      reflector,
      mockRcService as never,
      workspaceService as never,
      abilityFactory as never,
    );

    const request: Record<string, unknown> = {
      headers: { 'x-workspace-id': 'ws1' },
      user: { id: 'u1' },
    };
    const ctx = makeCtx(
      (current) => current.can('read_workspace_analytics', 'Workspace'),
      request,
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(workspaceService.findMembership).toHaveBeenCalledWith('u1', 'ws1');
    expect(abilityFactory.createForUserInWorkspace).toHaveBeenCalledWith(
      'u1',
      'ws1',
      WorkspaceRole.MEMBER,
    );
    expect(mockRcService.setAbility).toHaveBeenCalledWith(ability);
    expect(request['workspace']).toEqual({ id: 'ws1', role: WorkspaceRole.MEMBER });
  });

  it('uses project-scoped membership for project analytics', async () => {
    const ability = { can: jest.fn().mockReturnValue(true) } as unknown as AppAbility;
    const workspaceService = {
      findMembership: jest.fn().mockResolvedValue({ role: WorkspaceRole.MEMBER }),
    };
    const abilityFactory = {
      createForUserInProject: jest.fn().mockReturnValue(ability),
    };
    const projectMembershipService = {
      findMembership: jest.fn().mockResolvedValue({ role: ProjectRole.VIEWER }),
    };
    mockRcService.getAbility.mockReturnValue(null);
    mockRcService.getUserId.mockReturnValue('u1');
    guard = new AbilityGuard(
      reflector,
      mockRcService as never,
      workspaceService as never,
      abilityFactory as never,
      projectMembershipService as never,
    );

    const ctx = makeCtx(
      (current) => current.can('read_project_analytics', 'Project'),
      { headers: { 'x-workspace-id': 'ws1' }, params: { projectId: 'p1' } },
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(projectMembershipService.findMembership).toHaveBeenCalledWith('p1', 'ws1', 'u1');
    expect(abilityFactory.createForUserInProject).toHaveBeenCalledWith(
      'u1',
      'ws1',
      'p1',
      WorkspaceRole.MEMBER,
      ProjectRole.VIEWER,
    );
  });
});
