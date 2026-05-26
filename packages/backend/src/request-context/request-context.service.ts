import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { MongoAbility } from '@casl/ability';
import { WorkspaceRole } from '@jitre/shared';
import type { Action, Subject } from '../auth/casl/ability.types';

export type AppAbility = MongoAbility<[Action, Subject]>;

export interface RequestContextStore {
  requestId: string;
  userId: string | null;
  workspaceId: string | null;
  role: WorkspaceRole | null;
}

export const RC_KEYS = {
  REQUEST_ID: 'requestId',
  USER_ID: 'userId',
  WORKSPACE_ID: 'workspaceId',
  ROLE: 'role',
  ABILITY: 'ability',
} as const;

/**
 * Thin wrapper around `nestjs-cls`. Lives the lifetime of one HTTP request
 * (or one queue job once we wire jobs in Fase 5). Everything inside the
 * stack — guards, services, subscribers — reads the current actor from here
 * instead of having to plumb userId through every method.
 *
 * Used by:
 *   - `AuditSubscriber` to fill `createdBy` / `updatedBy`
 *   - `TenancyInterceptor` to apply the workspace scope
 *   - Pino logger correlation via `requestId`
 */
@Injectable()
export class RequestContextService {
  constructor(private readonly cls: ClsService) {}

  setRequestId(requestId: string): void {
    this.cls.set(RC_KEYS.REQUEST_ID, requestId);
  }

  getRequestId(): string | null {
    return this.cls.get<string>(RC_KEYS.REQUEST_ID) ?? null;
  }

  setUserId(userId: string | null): void {
    this.cls.set(RC_KEYS.USER_ID, userId);
  }

  getUserId(): string | null {
    return this.cls.get<string | null>(RC_KEYS.USER_ID) ?? null;
  }

  setWorkspaceId(workspaceId: string | null): void {
    this.cls.set(RC_KEYS.WORKSPACE_ID, workspaceId);
  }

  getWorkspaceId(): string | null {
    return this.cls.get<string | null>(RC_KEYS.WORKSPACE_ID) ?? null;
  }

  setRole(role: WorkspaceRole | null): void {
    this.cls.set(RC_KEYS.ROLE, role);
  }

  getRole(): WorkspaceRole | null {
    return this.cls.get<WorkspaceRole | null>(RC_KEYS.ROLE) ?? null;
  }

  setAbility(ability: AppAbility): void {
    this.cls.set(RC_KEYS.ABILITY, ability);
  }

  getAbility(): AppAbility | null {
    return this.cls.get<AppAbility>(RC_KEYS.ABILITY) ?? null;
  }

  snapshot(): RequestContextStore {
    return {
      requestId: this.getRequestId() ?? 'no-request-id',
      userId: this.getUserId(),
      workspaceId: this.getWorkspaceId(),
      role: this.getRole(),
    };
  }
}
