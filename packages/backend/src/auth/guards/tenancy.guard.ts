import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_TENANCY_KEY } from '../decorators/skip-tenancy.decorator';
import { WorkspaceService } from '../../workspace/workspace.service';
import { RequestContextService } from '../../request-context/request-context.service';
import { CaslAbilityFactory } from '../casl/ability.factory';
import type { WorkspaceRole } from '@jitre/shared';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the active workspace from the `x-workspace-id` header, validates
 * the caller's membership, and seeds `RequestContext` with workspaceId, role
 * and ability. Runs as a guard (after `JwtAuthGuard`) so any downstream guard
 * — e.g. `AiQuotaGuard`, `AbilityGuard` — can rely on the context being set.
 */
@Injectable()
export class TenancyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspaceService: WorkspaceService,
    private readonly requestContext: RequestContextService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skipTenancy = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANCY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic || skipTenancy) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user?: { id: string };
      workspace?: { id: string; role: WorkspaceRole };
    }>();
    const workspaceId = request.headers?.['x-workspace-id'];

    if (!workspaceId) {
      throw new BadRequestException('WORKSPACE_HEADER_REQUIRED');
    }

    if (!UUID_RE.test(workspaceId)) {
      throw new BadRequestException('WORKSPACE_HEADER_INVALID');
    }

    const userId = this.requestContext.getUserId();
    const membership = await this.workspaceService.findMembership(
      userId!,
      workspaceId,
    );

    if (!membership) {
      throw new ForbiddenException('TENANT_MISMATCH');
    }

    const role = membership.role as WorkspaceRole;
    this.requestContext.setWorkspaceId(workspaceId);
    this.requestContext.setRole(role);

    const ability = this.abilityFactory.createForUserInWorkspace(
      userId!,
      workspaceId,
      role,
    );
    this.requestContext.setAbility(ability);

    request.workspace = { id: workspaceId, role };
    return true;
  }
}
