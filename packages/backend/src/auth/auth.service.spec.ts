import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
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

const mockUserService = {
  create: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  updateLastLoginAt: jest.fn(),
};

const mockWorkspaceService = {
  create: jest.fn(),
  listForUser: jest.fn(),
};

const mockSessionService = {
  create: jest.fn(),
  findActiveByHash: jest.fn(),
  findActiveForUser: jest.fn(),
  rotate: jest.fn(),
  revoke: jest.fn(),
  revokeAllForUser: jest.fn(),
};

const mockTokenService = {
  issueAccessToken: jest.fn(),
  issueRefreshToken: jest.fn(),
  issueCsrfToken: jest.fn(),
  hashRefreshToken: jest.fn(),
};

const mockPasswordHasher = {
  hash: jest.fn(),
  verify: jest.fn(),
};

const mockEventBus = {
  publish: jest.fn(),
};

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  status: 'active',
  passwordHash: '$argon2id$v=1$hashed',
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWorkspaceService.listForUser.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: PasswordHasherService, useValue: mockPasswordHasher },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should create user, workspace, session and return tokens', async () => {
      const user = makeUser();
      mockPasswordHasher.hash.mockResolvedValue('$argon2id$...');
      mockUserService.create.mockResolvedValue(user);
      mockWorkspaceService.create.mockResolvedValue({
        id: 'ws-1',
        name: "Test User's workspace",
      });
      mockTokenService.issueRefreshToken.mockReturnValue({
        token: 'raw-refresh',
        hash: 'hashed-refresh',
        expiresAt: new Date(Date.now() + 86400000),
      });
      mockTokenService.issueCsrfToken.mockReturnValue('csrf-token');
      mockTokenService.issueAccessToken.mockResolvedValue('access-token');
      mockSessionService.create.mockResolvedValue({ id: 'session-1' });

      const result = await service.register(
        {
          email: 'test@example.com',
          password: 'ValidPass1!',
          displayName: 'Test User',
        },
        { userAgent: 'Mozilla', ip: '1.2.3.4' },
      );

      expect(mockPasswordHasher.hash).toHaveBeenCalledWith('ValidPass1!');
      expect(mockUserService.create).toHaveBeenCalled();
      expect(mockWorkspaceService.create).toHaveBeenCalled();
      expect(mockSessionService.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('raw-refresh');
      expect(result.csrfToken).toBe('csrf-token');
      expect(result.user.id).toBe('user-1');

      const publishCalls = mockEventBus.publish.mock.calls;
      const publishedNames = publishCalls.map(
        ([event]: [{ name: string }]) => event.name,
      );
      expect(publishedNames).toContain('user.registered');
      expect(publishedNames).toContain('session.created');
      expect(publishedNames).not.toContain('workspace.created');
      expect(publishedNames).not.toContain('workspace.member.added');

      const userRegEvent = publishCalls.find(
        ([e]: [UserRegisteredEvent]) => e instanceof UserRegisteredEvent,
      )?.[0] as UserRegisteredEvent;
      expect(userRegEvent).toBeDefined();
      expect(userRegEvent.aggregateId).toBe('user-1');
      expect(userRegEvent.payload.email).toBe('test@example.com');
      expect(userRegEvent.payload.displayName).toBe('Test User');
    });

    it('should propagate ConflictException from UserService on duplicate email', async () => {
      mockPasswordHasher.hash.mockResolvedValue('hash');
      mockUserService.create.mockRejectedValue(
        new ConflictException('EMAIL_TAKEN'),
      );

      await expect(
        service.register(
          {
            email: 'taken@example.com',
            password: 'ValidPass1!',
            displayName: 'Test',
          },
          { userAgent: 'Mozilla', ip: '1.2.3.4' },
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      const user = makeUser();
      mockUserService.findByEmail.mockResolvedValue(user);
      mockPasswordHasher.verify.mockResolvedValue(true);
      mockTokenService.issueRefreshToken.mockReturnValue({
        token: 'raw-refresh',
        hash: 'hashed',
        expiresAt: new Date(Date.now() + 86400000),
      });
      mockTokenService.issueCsrfToken.mockReturnValue('csrf-tok');
      mockTokenService.issueAccessToken.mockResolvedValue('access-tok');
      mockSessionService.create.mockResolvedValue({ id: 's1' });
      mockUserService.updateLastLoginAt.mockResolvedValue(undefined);
      mockWorkspaceService.listForUser.mockResolvedValue([
        {
          id: 'ws-1',
          name: 'Workspace',
          slug: 'workspace',
          memberships: [{ userId: 'user-1', role: 'owner' }],
        },
      ]);

      const result = await service.login('test@example.com', 'ValidPass1!', {
        userAgent: 'Chrome',
        ip: '2.3.4.5',
      });

      expect(mockPasswordHasher.verify).toHaveBeenCalledWith(
        user.passwordHash,
        'ValidPass1!',
      );
      expect(mockUserService.updateLastLoginAt).toHaveBeenCalledWith('user-1');
      expect(result.accessToken).toBe('access-tok');
      expect(result.user.role).toBe('admin');
      expect(result.workspace?.role).toBe('owner');

      const sessionCreated = mockEventBus.publish.mock.calls.find(
        ([e]: [SessionCreatedEvent]) => e instanceof SessionCreatedEvent,
      )?.[0] as SessionCreatedEvent;
      expect(sessionCreated).toBeDefined();
      expect(sessionCreated.actorUserId).toBe('user-1');
    });

    it('should throw UnauthorizedException for unknown email', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('unknown@example.com', 'anyPass', {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockUserService.findByEmail.mockResolvedValue(makeUser());
      mockPasswordHasher.verify.mockResolvedValue(false);

      await expect(
        service.login('test@example.com', 'WrongPass', {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for disabled account', async () => {
      mockUserService.findByEmail.mockResolvedValue(
        makeUser({ status: 'disabled' }),
      );
      mockPasswordHasher.verify.mockResolvedValue(true);

      await expect(
        service.login('test@example.com', 'ValidPass1!', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    it('should rotate session and return new access token', async () => {
      const session = {
        id: 's1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
      };
      const user = makeUser();
      mockTokenService.hashRefreshToken.mockReturnValue('hashed-t1');
      mockSessionService.findActiveByHash.mockResolvedValue(session);
      mockUserService.findById.mockResolvedValue(user);
      mockTokenService.issueRefreshToken.mockReturnValue({
        token: 'raw-t2',
        hash: 'hashed-t2',
        expiresAt: new Date(Date.now() + 86400000),
      });
      mockTokenService.issueCsrfToken.mockReturnValue('new-csrf');
      mockTokenService.issueAccessToken.mockResolvedValue('new-access');
      mockSessionService.rotate.mockResolvedValue(undefined);
      mockWorkspaceService.listForUser.mockResolvedValue([
        {
          id: 'ws-1',
          name: 'Workspace',
          slug: 'workspace',
          memberships: [{ userId: 'user-1', role: 'admin' }],
        },
      ]);

      const result = await service.refresh('raw-t1', {});

      expect(mockTokenService.hashRefreshToken).toHaveBeenCalledWith('raw-t1');
      expect(mockSessionService.findActiveByHash).toHaveBeenCalledWith(
        'hashed-t1',
      );
      expect(mockSessionService.rotate).toHaveBeenCalledWith(
        's1',
        'hashed-t2',
        expect.any(Date),
      );
      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('raw-t2');
      expect(result.user.role).toBe('admin');
      expect(result.workspace?.role).toBe('admin');
    });

    it('should throw UnauthorizedException when session not found (TOKEN_REUSE)', async () => {
      mockTokenService.hashRefreshToken.mockReturnValue('hashed-old');
      mockSessionService.findActiveByHash.mockResolvedValue(null);

      await expect(service.refresh('old-token', {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when session rotate fails (race condition)', async () => {
      const session = {
        id: 's1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
      };
      const user = makeUser();
      mockTokenService.hashRefreshToken.mockReturnValue('hashed');
      mockSessionService.findActiveByHash.mockResolvedValue(session);
      mockUserService.findById.mockResolvedValue(user);
      mockTokenService.issueRefreshToken.mockReturnValue({
        token: 'new-t',
        hash: 'new-h',
        expiresAt: new Date(Date.now() + 86400000),
      });
      mockTokenService.issueCsrfToken.mockReturnValue('csrf');
      mockTokenService.issueAccessToken.mockResolvedValue('access');
      mockSessionService.rotate.mockRejectedValue(
        new Error('SESSION_NOT_FOUND'),
      );

      await expect(service.refresh('raw-t1', {})).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('should revoke the session', async () => {
      mockSessionService.revoke.mockResolvedValue(undefined);
      await service.logout('session-1');
      expect(mockSessionService.revoke).toHaveBeenCalledWith('session-1');
    });
  });

  describe('logoutByToken', () => {
    it('should revoke session and emit SessionRevokedEvent', async () => {
      const session = { id: 's1', userId: 'user-1' };
      mockTokenService.hashRefreshToken.mockReturnValue('hashed-tok');
      mockSessionService.findActiveByHash.mockResolvedValue(session);
      mockSessionService.revoke.mockResolvedValue(undefined);

      await service.logoutByToken('raw-tok');

      expect(mockSessionService.revoke).toHaveBeenCalledWith('s1');
      const revokedEvent = mockEventBus.publish.mock.calls.find(
        ([e]: [SessionRevokedEvent]) => e instanceof SessionRevokedEvent,
      )?.[0] as SessionRevokedEvent;
      expect(revokedEvent).toBeDefined();
      expect(revokedEvent.aggregateId).toBe('s1');
      expect(revokedEvent.payload.reason).toBe('logout');
    });

    it('should not emit when session not found', async () => {
      mockTokenService.hashRefreshToken.mockReturnValue('hashed-missing');
      mockSessionService.findActiveByHash.mockResolvedValue(null);

      await service.logoutByToken('unknown-tok');

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('should revoke all sessions and emit one SessionRevokedEvent per session', async () => {
      const sessions = [
        { id: 's1', userId: 'user-1' },
        { id: 's2', userId: 'user-1' },
      ];
      mockSessionService.findActiveForUser.mockResolvedValue(sessions);
      mockSessionService.revokeAllForUser.mockResolvedValue(2);

      await service.logoutAll('user-1');

      expect(mockSessionService.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
      );
      const revokedEvents = mockEventBus.publish.mock.calls
        .map(([e]: [SessionRevokedEvent]) => e)
        .filter((e) => e instanceof SessionRevokedEvent);
      expect(revokedEvents).toHaveLength(2);
      expect(revokedEvents[0].payload.reason).toBe('logout-all');
      expect(revokedEvents[1].payload.reason).toBe('logout-all');
    });
  });
});
