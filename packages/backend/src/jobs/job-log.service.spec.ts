import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JobLogService } from './job-log.service';
import { JobLog } from './job-log.entity';

const makeRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  findAndCount: jest.fn(),
  upsert: jest.fn(),
});

describe('JobLogService', () => {
  let service: JobLogService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobLogService,
        { provide: getRepositoryToken(JobLog), useValue: repo },
      ],
    }).compile();
    service = module.get(JobLogService);
    jest.clearAllMocks();
  });

  describe('upsert()', () => {
    it('creates a new row when none exists', async () => {
      repo.findOne.mockResolvedValue(null);
      const saved = {
        jobId: 'j1',
        queueName: 'cleanup',
        jobType: 'attachments.cleanup-soft-deleted',
        status: 'queued',
        attemptCount: 0,
        errorMessage: null,
        payload: {},
        durationMs: null,
      };
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);

      const result = await service.upsert('j1', {
        queueName: 'cleanup',
        jobType: 'attachments.cleanup-soft-deleted',
        status: 'queued',
        payload: {},
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'j1', status: 'queued' }),
      );
      expect(repo.save).toHaveBeenCalled();
      expect(result.status).toBe('queued');
    });

    it('updates an existing row', async () => {
      const existing = {
        jobId: 'j1',
        status: 'queued',
        attemptCount: 0,
      };
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockResolvedValue({ ...existing, status: 'active' });

      const result = await service.upsert('j1', { status: 'active' });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
      );
      expect(result.status).toBe('active');
    });
  });

  describe('recordEvent()', () => {
    it('waiting → status queued, attemptCount 0', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({ jobId: 'j1' });
      repo.save.mockResolvedValue({ jobId: 'j1', status: 'queued' });

      await service.recordEvent('cleanup', 'waiting', {
        jobId: 'j1',
        name: 'attachments.cleanup-soft-deleted',
        attemptsMade: 0,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'queued', attemptCount: 0 }),
      );
    });

    it('active → status active', async () => {
      repo.findOne.mockResolvedValue({
        jobId: 'j2',
        status: 'queued',
        attemptCount: 0,
      });
      repo.save.mockResolvedValue({ jobId: 'j2', status: 'active' });

      await service.recordEvent('cleanup', 'active', {
        jobId: 'j2',
        name: 'x',
        attemptsMade: 0,
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
      );
    });

    it('completed → status completed, durationMs set', async () => {
      repo.findOne.mockResolvedValue({
        jobId: 'j3',
        status: 'active',
        attemptCount: 0,
      });
      repo.save.mockImplementation((r: Record<string, unknown>) =>
        Promise.resolve(r),
      );

      // Inject an active timer so durationMs can be computed

      (service as any).activeTimers.set('j3', Date.now() - 1500);

      await service.recordEvent('cleanup', 'completed', {
        jobId: 'j3',
        name: 'x',
        attemptsMade: 0,
      });

      const saved = repo.save.mock.calls[0][0];
      expect(saved.status).toBe('completed');
      expect(saved.durationMs).toBeGreaterThanOrEqual(1450);
    });

    it('failed → status failed, errorMessage and attemptCount set', async () => {
      repo.findOne.mockResolvedValue({
        jobId: 'j4',
        status: 'active',
        attemptCount: 0,
      });
      repo.save.mockImplementation((r: Record<string, unknown>) =>
        Promise.resolve(r),
      );

      await service.recordEvent('cleanup', 'failed', {
        jobId: 'j4',
        name: 'x',
        attemptsMade: 3,
        failedReason: 'boom',
      });

      const saved = repo.save.mock.calls[0][0];
      expect(saved.status).toBe('failed');
      expect(saved.errorMessage).toBe('boom');
      expect(saved.attemptCount).toBe(3);
    });
  });

  describe('queryByStatus()', () => {
    it('returns paginated JobLog rows filtered by queueName and status', async () => {
      const rows = [{ jobId: 'j1' }, { jobId: 'j2' }];
      repo.findAndCount.mockResolvedValue([rows, 2]);

      const page = await service.queryByStatus({
        queueName: 'cleanup',
        status: 'failed',
        page: 1,
        pageSize: 10,
      });

      expect(page.total).toBe(2);
      expect(page.items).toHaveLength(2);
    });
  });

  describe('payload sanitization', () => {
    it('default sanitizer strips keys matching /token|secret|password|signature|key/i', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockImplementation((data: Record<string, unknown>) => data);
      repo.save.mockImplementation((r: Record<string, unknown>) =>
        Promise.resolve(r),
      );

      await service.upsert('j5', {
        queueName: 'default',
        jobType: 'x',
        status: 'queued',
        payload: {
          file: 'a.pdf',
          token: 'secret-abc',
          password: '1234',
          keepMe: 'yes',
        },
      });

      const created = repo.create.mock.calls[0][0];
      expect(created.payload.token).toBeUndefined();
      expect(created.payload.password).toBeUndefined();
      expect(created.payload.file).toBe('a.pdf');
      expect(created.payload.keepMe).toBe('yes');
    });
  });
});
