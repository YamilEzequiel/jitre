import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { PasswordHasherService } from './services/password-hasher.service';
import { EventBusService } from '../events/event-bus.service';
import {
  UserRegisteredEvent,
  SessionCreatedEvent,
  SessionRevokedEvent,
} from '../events';
import type { UserEntity } from '../user/user.entity';
import { WorkspaceRole } from '@jitre/shared';

interface RegisterDto {
  email: string;
  password: string;
  displayName: string;
}

interface AuthWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

interface AuthUserSummary {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
}

interface RegisterResult {
  user: AuthUserSummary;
  workspace: AuthWorkspaceSummary | null;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

interface LoginResult {
  user: AuthUserSummary;
  workspace: AuthWorkspaceSummary | null;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

interface RefreshResult {
  user: AuthUserSummary;
  workspace: AuthWorkspaceSummary | null;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly workspaceService: WorkspaceService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly eventBus: EventBusService,
  ) {}

  async register(
    dto: RegisterDto,
    deviceInfo: object,
  ): Promise<RegisterResult> {
    const passwordHash = await this.passwordHasher.hash(dto.password);
    const user = await this.userService.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
    });

    // WorkspaceService.create owns workspace.created + workspace.member.added emissions
    const createdWorkspace = await this.workspaceService.create(user.id, {
      name: `${dto.displayName}'s workspace`,
    });

    const {
      token: refreshToken,
      hash: refreshTokenHash,
      expiresAt,
    } = this.tokenService.issueRefreshToken();
    const csrfToken = this.tokenService.issueCsrfToken();
    const accessToken = await this.tokenService.issueAccessToken({
      sub: user.id,
      email: user.email,
    });

    const session = await this.sessionService.create({
      userId: user.id,
      refreshTokenHash,
      deviceInfo,
      expiresAt,
    });

    this.eventBus.publish(
      new UserRegisteredEvent({
        aggregateId: user.id,
        aggregateType: 'User',
        actorUserId: user.id,
        payload: { email: user.email, displayName: user.displayName },
      }),
    );

    this.eventBus.publish(
      new SessionCreatedEvent({
        aggregateId: session.id,
        aggregateType: 'Session',
        actorUserId: user.id,
        payload: {
          sessionId: session.id,
          deviceInfo: deviceInfo as Record<string, unknown>,
        },
      }),
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: 'admin',
      },
      workspace: {
        id: createdWorkspace.id,
        name: createdWorkspace.name,
        slug: createdWorkspace.slug,
        role: WorkspaceRole.OWNER,
      },
      accessToken,
      refreshToken,
      csrfToken,
    };
  }

  async login(
    email: string,
    password: string,
    deviceInfo: object,
  ): Promise<LoginResult> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const valid = await this.passwordHasher.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    if (user.status === 'disabled') {
      throw new ForbiddenException('ACCOUNT_DISABLED');
    }

    const {
      token: refreshToken,
      hash: refreshTokenHash,
      expiresAt,
    } = this.tokenService.issueRefreshToken();
    const csrfToken = this.tokenService.issueCsrfToken();
    const accessToken = await this.tokenService.issueAccessToken({
      sub: user.id,
      email: user.email,
    });

    const session = await this.sessionService.create({
      userId: user.id,
      refreshTokenHash,
      deviceInfo,
      expiresAt,
    });
    await this.userService.updateLastLoginAt(user.id);

    this.eventBus.publish(
      new SessionCreatedEvent({
        aggregateId: session.id,
        aggregateType: 'Session',
        actorUserId: user.id,
        payload: {
          sessionId: session.id,
          deviceInfo: deviceInfo as Record<string, unknown>,
        },
      }),
    );

    const workspaces = await this.workspaceService.listForUser(user.id);
    const ws = workspaces[0];
    const workspaceRole = this.membershipRole(ws?.memberships, user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: this.userRole(workspaceRole),
      },
      workspace: ws
        ? {
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            role: workspaceRole,
          }
        : null,
      accessToken,
      refreshToken,
      csrfToken,
    };
  }

  async refresh(
    rawRefreshToken: string,
    _deviceInfo: object,
  ): Promise<RefreshResult> {
    const hash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const session = await this.sessionService.findActiveByHash(hash);

    if (!session) {
      throw new UnauthorizedException('TOKEN_REUSE');
    }

    const user = await this.userService.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException('USER_NOT_FOUND');
    }

    const {
      token: refreshToken,
      hash: newHash,
      expiresAt,
    } = this.tokenService.issueRefreshToken();
    const csrfToken = this.tokenService.issueCsrfToken();
    const accessToken = await this.tokenService.issueAccessToken({
      sub: user.id,
      email: user.email,
    });

    await this.sessionService.rotate(session.id, newHash, expiresAt);

    const workspaces = await this.workspaceService.listForUser(user.id);
    const ws = workspaces[0];
    const workspaceRole = this.membershipRole(ws?.memberships, user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: this.userRole(workspaceRole),
      },
      workspace: ws
        ? {
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            role: workspaceRole,
          }
        : null,
      accessToken,
      refreshToken,
      csrfToken,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionService.revoke(sessionId);
  }

  async logoutByToken(rawRefreshToken: string): Promise<void> {
    const hash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const session = await this.sessionService.findActiveByHash(hash);
    if (session) {
      await this.sessionService.revoke(session.id);
      this.eventBus.publish(
        new SessionRevokedEvent({
          aggregateId: session.id,
          aggregateType: 'Session',
          actorUserId: session.userId,
          payload: { sessionId: session.id, reason: 'logout' },
        }),
      );
    }
  }

  async logoutAll(userId: string): Promise<void> {
    const sessions = await this.sessionService.findActiveForUser(userId);
    await this.sessionService.revokeAllForUser(userId);
    for (const session of sessions) {
      this.eventBus.publish(
        new SessionRevokedEvent({
          aggregateId: session.id,
          aggregateType: 'Session',
          actorUserId: userId,
          payload: { sessionId: session.id, reason: 'logout-all' },
        }),
      );
    }
  }

  private membershipRole(
    memberships: unknown[] | undefined,
    userId: string,
  ): WorkspaceRole {
    const membership = (
      memberships as Array<{ userId: string; role: WorkspaceRole }> | undefined
    )?.find(candidate => candidate.userId === userId);
    return membership?.role ?? WorkspaceRole.MEMBER;
  }

  private userRole(role: WorkspaceRole): 'admin' | 'member' {
    return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN
      ? 'admin'
      : 'member';
  }
}
