import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasAtLeastRole, WorkspaceRole } from '@jitre/shared';
import { REQUIRE_ROLE_KEY } from '../decorators/require-role.decorator';
import { RequestContextService } from '../../request-context/request-context.service';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRole = this.reflector.getAllAndOverride<
      WorkspaceRole | undefined
    >(REQUIRE_ROLE_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRole) {
      return true;
    }

    const currentRole = this.requestContext.getRole();
    if (!currentRole || !hasAtLeastRole(currentRole, requiredRole)) {
      throw new ForbiddenException('INSUFFICIENT_ROLE');
    }

    return true;
  }
}
