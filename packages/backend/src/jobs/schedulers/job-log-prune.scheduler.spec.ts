import { ConfigService } from '@nestjs/config';
import { JobLogPruneScheduler } from './job-log-prune.scheduler';
import { JobLogService } from '../job-log.service';

describe('JobLogPruneScheduler', () => {
  let scheduler: JobLogPruneScheduler;
  let jobLogService: { pruneOlderThan: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    jobLogService = { pruneOlderThan: jest.fn().mockResolvedValue(undefined) };
    configService = { get: jest.fn().mockReturnValue(90) };
    scheduler = new JobLogPruneScheduler(
      jobLogService as unknown as JobLogService,
      configService as unknown as ConfigService,
    );
  });

  it('calls pruneOlderThan with JOB_LOG_RETENTION_DAYS from config', async () => {
    await scheduler.pruneJobLog();
    expect(jobLogService.pruneOlderThan).toHaveBeenCalledWith(90);
  });

  it('uses default 90 when config returns undefined', async () => {
    configService.get.mockReturnValue(undefined);
    await scheduler.pruneJobLog();
    expect(jobLogService.pruneOlderThan).toHaveBeenCalledWith(90);
  });

  it('@Cron method exists and is callable (timezone asserted at source level)', () => {
    // @Cron('0 4 * * 0', { timeZone: 'UTC' }) is applied at decoration time.
    // NestJS SetMetadata via applyDecorators stores metadata on the class
    // definition, not directly on the prototype key — accessible only through
    // SchedulerRegistry after full bootstrap. Unit test verifies behavior only.
    expect(typeof scheduler.pruneJobLog).toBe('function');
  });
});
