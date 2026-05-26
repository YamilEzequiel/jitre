import { JobLogService } from './job-log.service';
import { BaseJobTrackerSubscriber } from './job-tracker.subscriber';

class TestSubscriber extends BaseJobTrackerSubscriber {
  readonly queueName = 'test-queue';
}

describe('BaseJobTrackerSubscriber', () => {
  let subscriber: TestSubscriber;
  let jobLogService: jest.Mocked<Pick<JobLogService, 'recordEvent'>>;

  beforeEach(() => {
    jobLogService = { recordEvent: jest.fn().mockResolvedValue(undefined) };
    subscriber = new TestSubscriber(jobLogService as unknown as JobLogService);
  });

  it('onWaiting calls recordEvent with waiting event', async () => {
    await subscriber.onWaiting({ jobId: 'j1', name: 'x', attemptsMade: 0 });
    expect(jobLogService.recordEvent).toHaveBeenCalledWith(
      'test-queue',
      'waiting',
      expect.objectContaining({ jobId: 'j1' }),
    );
  });

  it('onActive calls recordEvent with active event', async () => {
    await subscriber.onActive({ jobId: 'j2', name: 'x', attemptsMade: 0 });
    expect(jobLogService.recordEvent).toHaveBeenCalledWith(
      'test-queue',
      'active',
      expect.objectContaining({ jobId: 'j2' }),
    );
  });

  it('onCompleted calls recordEvent with completed event', async () => {
    await subscriber.onCompleted({ jobId: 'j3', name: 'x', attemptsMade: 0 });
    expect(jobLogService.recordEvent).toHaveBeenCalledWith(
      'test-queue',
      'completed',
      expect.objectContaining({ jobId: 'j3' }),
    );
  });

  it('onFailed calls recordEvent with failed event and failedReason', async () => {
    await subscriber.onFailed({
      jobId: 'j4',
      name: 'x',
      attemptsMade: 2,
      failedReason: 'timeout',
    });
    expect(jobLogService.recordEvent).toHaveBeenCalledWith(
      'test-queue',
      'failed',
      expect.objectContaining({
        jobId: 'j4',
        failedReason: 'timeout',
        attemptsMade: 2,
      }),
    );
  });
});
