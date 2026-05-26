import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EmailNotificationDriver } from './email-notification.driver';
import { NotificationType } from '@jitre/shared';

describe('EmailNotificationDriver', () => {
  let driver: EmailNotificationDriver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailNotificationDriver],
    }).compile();
    driver = module.get(EmailNotificationDriver);
  });

  it('has name "email"', () => {
    expect(driver.name).toBe('email');
  });

  it('does not throw on send', async () => {
    await expect(
      driver.send({
        workspaceId: 'ws-1',
        recipientUserId: 'u-1',
        type: NotificationType.WORKSPACE_INVITED,
        title: 'You were invited',
      }),
    ).resolves.toBeUndefined();
  });

  it('logs with [STUB email] substring', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await driver.send({
      workspaceId: 'ws-1',
      recipientUserId: 'u-1',
      type: NotificationType.WORKSPACE_INVITED,
      title: 'Test Email',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[STUB email]'),
    );
  });
});
