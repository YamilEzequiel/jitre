import { DrainEmailNotificationsProcessor } from './drain-email-notifications.processor';

const makeJob = (notificationId: string) =>
  ({
    data: { notificationId },
    attemptsMade: 0,
    id: 'job-1',
  }) as unknown as import('bullmq').Job;

describe('DrainEmailNotificationsProcessor', () => {
  let processor: DrainEmailNotificationsProcessor;
  let notificationRepo: { findOne: jest.Mock; save: jest.Mock };
  let emailDriver: { send: jest.Mock };

  beforeEach(() => {
    notificationRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    emailDriver = { send: jest.fn().mockResolvedValue(undefined) };
    processor = new DrainEmailNotificationsProcessor(
      notificationRepo as never,
      emailDriver,
    );
  });

  it('calls emailDriver.send and stamps emailSentAt', async () => {
    const notification = {
      id: 'N1',
      recipientUserId: 'U1',
      title: 'Hello',
      body: 'World',
      emailSentAt: null,
    };
    notificationRepo.findOne.mockResolvedValue(notification);

    await processor.process(makeJob('N1'));

    expect(emailDriver.send).toHaveBeenCalledTimes(1);
    expect(notificationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ emailSentAt: expect.any(Date) }),
    );
  });

  it('throws when notification not found so BullMQ can retry', async () => {
    notificationRepo.findOne.mockResolvedValue(null);

    await expect(processor.process(makeJob('missing'))).rejects.toThrow();
    expect(emailDriver.send).not.toHaveBeenCalled();
  });

  it('re-throws on emailDriver failure so BullMQ retries', async () => {
    notificationRepo.findOne.mockResolvedValue({
      id: 'N1',
      title: 'x',
      body: 'y',
      emailSentAt: null,
    });
    emailDriver.send.mockRejectedValue(new Error('SMTP error'));

    await expect(processor.process(makeJob('N1'))).rejects.toThrow(
      'SMTP error',
    );
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });
});
