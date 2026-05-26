import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './audit-log.entity';
import { AuditAction } from '@jitre/shared';

const makeInput = (
  overrides: Partial<Parameters<AuditLogService['append']>[0]> = {},
) => ({
  workspaceId: 'ws-1',
  actorUserId: 'u-1',
  action: AuditAction.USER_REGISTERED,
  subjectType: 'User',
  subjectId: 'sub-1',
  summary: 'u-1 user.registered',
  diff: {},
  occurredAt: new Date('2024-01-01'),
  eventId: 'event-uuid-1',
  ...overrides,
});

const makeRow = (overrides = {}) => ({
  id: 'row-1',
  workspaceId: 'ws-1',
  actorUserId: 'u-1',
  action: AuditAction.USER_REGISTERED,
  subjectType: 'User',
  subjectId: 'sub-1',
  summary: 'u-1 user.registered',
  diff: {},
  occurredAt: new Date('2024-01-01'),
  eventId: 'event-uuid-1',
  ...overrides,
});

describe('AuditLogService', () => {
  let service: AuditLogService;
  const mockRepo = {
    save: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
      ],
    }).compile();
    service = module.get(AuditLogService);
  });

  describe('append', () => {
    it('inserts and returns the row on happy path', async () => {
      const row = makeRow();
      mockRepo.create.mockReturnValue(row);
      mockRepo.save.mockResolvedValue(row);

      const result = await service.append(makeInput());

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'event-uuid-1' }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toBe(row);
    });

    it('is idempotent: on duplicate eventId (23505) returns existing row', async () => {
      const existing = makeRow();
      const err = new QueryFailedError('INSERT', [], {
        code: '23505',
      } as unknown as Error);
      mockRepo.create.mockReturnValue(makeRow());
      mockRepo.save.mockRejectedValue(err);
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.append(makeInput());

      expect(result).toBe(existing);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { eventId: 'event-uuid-1' },
      });
    });

    it('re-throws non-uniqueness errors', async () => {
      const err = new QueryFailedError('INSERT', [], {
        code: '42P01',
      } as unknown as Error);
      mockRepo.create.mockReturnValue(makeRow());
      mockRepo.save.mockRejectedValue(err);

      await expect(service.append(makeInput())).rejects.toThrow(
        QueryFailedError,
      );
    });
  });

  describe('findByWorkspace', () => {
    it('returns items in newest-first order', async () => {
      const t1 = new Date('2024-01-01');
      const t3 = new Date('2024-01-03');
      const rows = [
        makeRow({ id: 'r3', occurredAt: t3 }),
        makeRow({ id: 'r1', occurredAt: t1 }),
      ];
      mockRepo.findAndCount.mockResolvedValue([rows, 2]);

      const page = await service.findByWorkspace('ws-1', {
        page: 1,
        pageSize: 10,
      });

      expect(page.items[0].occurredAt).toEqual(t3);
      expect(page.total).toBe(2);
      expect(page.page).toBe(1);
      expect(page.pageSize).toBe(10);
    });
  });

  describe('findBySubject', () => {
    it('applies subjectType and subjectId filters', async () => {
      mockRepo.findAndCount.mockResolvedValue([[makeRow()], 1]);

      await service.findBySubject('ws-1', 'User', 'sub-1', {
        page: 1,
        pageSize: 5,
      });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subjectType: 'User',
            subjectId: 'sub-1',
          }),
        }),
      );
    });
  });
});
