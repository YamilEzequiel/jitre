/**
 * E10 — Smoke test: AuthModule DI graph compiles without errors.
 * Does NOT spin up HTTP — just creates the testing module.
 * Note: TypeORM and DatabaseModule are mocked to avoid PG connection.
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthService } from './auth.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { PasswordHasherService } from './services/password-hasher.service';
import { CaslAbilityFactory } from './casl/ability.factory';
import { SessionEntity } from './session.entity';
import { UserService } from '../user/user.service';
import { UserEntity } from '../user/user.entity';
import { WorkspaceService } from '../workspace/workspace.service';
import { WorkspaceEntity } from '../workspace/workspace.entity';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';
import { RequestContextService } from '../request-context/request-context.service';
import { ClsService } from 'nestjs-cls';
import { EventBusService } from '../events/event-bus.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  count: jest.fn(),
});

const mockDataSource = {
  transaction: jest.fn(),
};

const mockClsService = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue({
    access: { secret: 'test', ttl: '15m' },
    refresh: { secret: 'test', ttl: '7d' },
    argon2: { memoryCost: 4096, timeCost: 2, parallelism: 1 },
    accessTtl: '15m',
    refreshTtlMs: 604800000,
  }),
};

describe('Auth DI graph (E10 smoke)', () => {
  it('should compile without DI errors', async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        SessionService,
        TokenService,
        PasswordHasherService,
        CaslAbilityFactory,
        UserService,
        WorkspaceService,
        RequestContextService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ClsService, useValue: mockClsService },
        { provide: getRepositoryToken(SessionEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(UserEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(WorkspaceEntity), useFactory: mockRepo },
        {
          provide: getRepositoryToken(WorkspaceMembershipEntity),
          useFactory: mockRepo,
        },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const authService = module.get(AuthService);
    expect(authService).toBeDefined();

    const tokenService = module.get(TokenService);
    expect(tokenService).toBeDefined();
  });
});
