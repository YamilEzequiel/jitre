import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, switchMap } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_TENANCY_KEY } from '../decorators/skip-tenancy.decorator';
import { WorkspaceService } from '../../workspace/workspace.service';
import { RequestContextService } from '../../request-context/request-context.service';
import { CaslAbilityFactory } from '../casl/ability.factory';
import type { WorkspaceRole } from '@jitre/shared';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TenancyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspaceService: WorkspaceService,
    private readonly requestContext: RequestContextService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skipTenancy = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANCY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic || skipTenancy) {
      return next.handle();
    }

    return from(this.checkTenancy(context)).pipe(
      switchMap(() => next.handle()),
    );
  }

  private async checkTenancy(context: ExecutionContext): Promise<void> {
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

    // Expose workspace on the Request so controllers reading `req.workspace`
    // (legacy style) work alongside ones using RequestContextService.
    request.workspace = { id: workspaceId, role };
  }
}
