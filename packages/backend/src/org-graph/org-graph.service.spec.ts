import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole } from '@jitre/shared';
import { OrgGraphService } from './org-graph.service';
import { UserReportsToEntity } from './user-reports-to.entity';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';
import { UserEntity } from '../user/user.entity';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeReport(
  overrides: Partial<UserReportsToEntity> = {},
): UserReportsToEntity {
  return {
    id: 'R1',
    workspaceId: 'W1',
    userId: 'U1',
    reportsToUserId: 'U2',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    createdByUserId: 'U-ADMIN',
    deletedAt: null,
    ...overrides,
  } as UserReportsToEntity;
}

function makeMembership(
  overrides: Partial<WorkspaceMembershipEntity> = {},
): WorkspaceMembershipEntity {
  return {
    id: 'M1',
    workspaceId: 'W1',
    userId: 'U1',
    role: WorkspaceRole.MEMBER,
    user: {
      id: 'U1',
      displayName: 'Alice',
      email: 'alice@example.com',
      avatarUrl: null,
      position: 'Engineer',
    } as UserEntity,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
  } as WorkspaceMembershipEntity;
}

// ─── Repository mocks ────────────────────────────────────────────────────────

let reportsRepo: {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  softDelete: jest.Mock;
};
let memberRepo: {
  find: jest.Mock;
};
let userRepo: {
  find: jest.Mock;
};

describe('OrgGraphService', () => {
  let service: OrgGraphService;

  beforeEach(async () => {
    jest.clearAllMocks();
    reportsRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    memberRepo = {
      find: jest.fn(),
    };
    userRepo = {
      find: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        OrgGraphService,
        {
          provide: getRepositoryToken(UserReportsToEntity),
          useValue: reportsRepo,
        },
        {
          provide: getRepositoryToken(WorkspaceMembershipEntity),
          useValue: memberRepo,
        },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
      ],
    }).compile();

    service = module.get(OrgGraphService);
  });

  // ── getOrgGraph ──────────────────────────────────────────────────────────

  describe('getOrgGraph()', () => {
    it('returns nodes (from memberships) and edges (from active relations)', async () => {
      memberRepo.find.mockResolvedValueOnce([
        makeMembership({
          userId: 'U1',
          role: WorkspaceRole.ADMIN,
          user: {
            id: 'U1',
            displayName: 'Alice',
            email: 'alice@example.com',
            avatarUrl: 'a.png',
            position: 'CEO',
          } as UserEntity,
        }),
        makeMembership({
          userId: 'U2',
          role: WorkspaceRole.MEMBER,
          user: {
            id: 'U2',
            displayName: 'Bob',
            email: 'bob@example.com',
            avatarUrl: null,
            position: null,
          } as UserEntity,
        }),
      ]);
      reportsRepo.find.mockResolvedValueOnce([
        makeReport({ userId: 'U2', reportsToUserId: 'U1' }),
      ]);

      const graph = await service.getOrgGraph('W1');

      expect(graph.nodes).toEqual([
        {
          id: 'U1',
          displayName: 'Alice',
          email: 'alice@example.com',
          avatarUrl: 'a.png',
          jobTitle: 'CEO',
          role: WorkspaceRole.ADMIN,
        },
        {
          id: 'U2',
          displayName: 'Bob',
          email: 'bob@example.com',
          avatarUrl: null,
          jobTitle: null,
          role: WorkspaceRole.MEMBER,
        },
      ]);
      expect(graph.edges).toEqual([{ from: 'U2', to: 'U1' }]);
      expect(memberRepo.find).toHaveBeenCalledWith({
        where: { workspaceId: 'W1', deletedAt: expect.anything() },
        relations: { user: true },
      });
    });

    it('returns empty arrays when workspace has no members or relations', async () => {
      memberRepo.find.mockResolvedValueOnce([]);
      reportsRepo.find.mockResolvedValueOnce([]);

      const graph = await service.getOrgGraph('W1');
      expect(graph).toEqual({ nodes: [], edges: [] });
    });
  });

  // ── addReport ────────────────────────────────────────────────────────────

  describe('addReport()', () => {
    it('throws BadRequestException when userId === supervisorId', async () => {
      await expect(
        service.addReport('W1', 'U1', 'U1', 'U-ADMIN'),
      ).rejects.toThrow(BadRequestException);
      expect(memberRepo.find).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when reporter is not in workspace', async () => {
      memberRepo.find.mockResolvedValueOnce([
        makeMembership({ userId: 'U2' }),
      ]); // missing U1

      await expect(
        service.addReport('W1', 'U1', 'U2', 'U-ADMIN'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when supervisor is not in workspace', async () => {
      memberRepo.find.mockResolvedValueOnce([
        makeMembership({ userId: 'U1' }),
      ]); // missing U2

      await expect(
        service.addReport('W1', 'U1', 'U2', 'U-ADMIN'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException on direct cycle (reverse edge exists)', async () => {
      memberRepo.find.mockResolvedValueOnce([
        makeMembership({ userId: 'U1' }),
        makeMembership({ userId: 'U2' }),
      ]);
      // Reverse edge: U2 already reports to U1
      reportsRepo.findOne.mockResolvedValueOnce(
        makeReport({ userId: 'U2', reportsToUserId: 'U1' }),
      );

      await expect(
        service.addReport('W1', 'U1', 'U2', 'U-ADMIN'),
      ).rejects.toThrow(ConflictException);
    });

    it('is idempotent — returns existing active edge if it already exists', async () => {
      memberRepo.find.mockResolvedValueOnce([
        makeMembership({ userId: 'U1' }),
        makeMembership({ userId: 'U2' }),
      ]);
      const existing = makeReport({ userId: 'U1', reportsToUserId: 'U2' });
      reportsRepo.findOne
        .mockResolvedValueOnce(null) // no reverse cycle
        .mockResolvedValueOnce(existing); // existing active row

      const result = await service.addReport('W1', 'U1', 'U2', 'U-ADMIN');

      expect(result).toBe(existing);
      expect(reportsRepo.save).not.toHaveBeenCalled();
    });

    it('creates a new edge when no active row exists', async () => {
      memberRepo.find.mockResolvedValueOnce([
        makeMembership({ userId: 'U1' }),
        makeMembership({ userId: 'U2' }),
      ]);
      reportsRepo.findOne
        .mockResolvedValueOnce(null) // no reverse cycle
        .mockResolvedValueOnce(null); // no existing
      const created = makeReport({ id: 'R2' });
      reportsRepo.create.mockReturnValueOnce(created);
      reportsRepo.save.mockResolvedValueOnce(created);

      const result = await service.addReport('W1', 'U1', 'U2', 'U-ADMIN');

      expect(reportsRepo.create).toHaveBeenCalledWith({
        workspaceId: 'W1',
        userId: 'U1',
        reportsToUserId: 'U2',
        createdByUserId: 'U-ADMIN',
      });
      expect(result).toBe(created);
    });
  });

  // ── removeReport ─────────────────────────────────────────────────────────

  describe('removeReport()', () => {
    it('throws NotFoundException when no active row matches', async () => {
      reportsRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.removeReport('W1', 'U1', 'U2'),
      ).rejects.toThrow(NotFoundException);
      expect(reportsRepo.softDelete).not.toHaveBeenCalled();
    });

    it('soft-deletes the matching active edge', async () => {
      const existing = makeReport();
      reportsRepo.findOne.mockResolvedValueOnce(existing);

      await service.removeReport('W1', 'U1', 'U2');

      expect(reportsRepo.softDelete).toHaveBeenCalledWith({ id: existing.id });
    });
  });
});
