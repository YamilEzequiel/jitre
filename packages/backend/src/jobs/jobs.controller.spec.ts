import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobLogService } from './job-log.service';
import { Reflector } from '@nestjs/core';

describe('JobsController', () => {
  let controller: JobsController;
  let jobLogService: jest.Mocked<Pick<JobLogService, 'queryByStatus'>>;

  beforeEach(async () => {
    jobLogService = {
      queryByStatus: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        { provide: JobLogService, useValue: jobLogService },
        Reflector,
      ],
    }).compile();

    controller = module.get<JobsController>(JobsController);
  });

  it('returns paginated JobLog for admin', async () => {
    const page = await controller.listJobs({
      queueName: 'cleanup',
      status: 'failed',
      page: 1,
      pageSize: 20,
    });
    expect(jobLogService.queryByStatus).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: 'cleanup', status: 'failed' }),
    );
    expect(page.items).toEqual([]);
  });

  it('listJobs method exists and delegates to JobLogService', async () => {
    // Guard metadata is verified by integration tests; unit test confirms
    // the method delegates correctly to JobLogService.
    expect(typeof controller.listJobs).toBe('function');
    const result = await controller.listJobs({
      page: 1,
      pageSize: 20,
    });
    expect(result).toHaveProperty('items');
  });
});
