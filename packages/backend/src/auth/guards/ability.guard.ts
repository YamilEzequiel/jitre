import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_ABILITY_KEY } from '../decorators/require-ability.decorator';
import {
  RequestContextService,
  AppAbility,
} from '../../request-context/request-context.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { CaslAbilityFactory } from '../casl/ability.factory';
import type { WorkspaceRole } from '@jitre/shared';
import { ProjectMembershipService } from '../../project/project-membership/project-membership.service';

@Injectable()
export class AbilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContextService,
    private readonly workspaceService?: WorkspaceService,
    private readonly abilityFactory?: CaslAbilityFactory,
    private readonly projectMembershipService?: ProjectMembershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const abilityFn = this.reflector.getAllAndOverride<
      ((ability: AppAbility) => boolean) | undefined
    >(REQUIRE_ABILITY_KEY, [context.getHandler(), context.getClass()]);

    if (!abilityFn) {
      return true;
    }

    const ability = await this.getOrBuildAbility(context);
    if (!ability || !abilityFn(ability)) {
      throw new ForbiddenException('ABILITY_DENIED');
    }

    return true;
  }

  private async getOrBuildAbility(
    context: ExecutionContext,
  ): Promise<AppAbility | null> {
    const existing = this.requestContext.getAbility();
    if (existing) return existing;
    if (!this.workspaceService || !this.abilityFactory) return null;

    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      params?: Record<string, string | undefined>;
      user?: { id?: string };
      workspace?: { id: string; role: WorkspaceRole };
    }>();
    const projectId = request.params?.['projectId'];
    const workspaceId = headerValue(request.headers?.['x-workspace-id']);
    const userId = this.requestContext.getUserId() ?? request.user?.id ?? null;
    if (!workspaceId || !userId) return null;

    const membership = await this.workspaceService.findMembership(userId, workspaceId);
    if (!membership) return null;

    const role = membership.role as WorkspaceRole;
    const projectMembership =
      projectId && this.projectMembershipService
        ? await this.projectMembershipService.findMembership(projectId, workspaceId, userId)
        : null;
    const ability = projectId
      ? this.abilityFactory.createForUserInProject(
          userId,
          workspaceId,
          projectId,
          role,
          projectMembership?.role,
        )
      : this.abilityFactory.createForUserInWorkspace(userId, workspaceId, role);
    this.requestContext.setWorkspaceId(workspaceId);
    this.requestContext.setRole(role);
    this.requestContext.setAbility(ability);
    request.workspace = { id: workspaceId, role };
    return ability;
  }
}

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
