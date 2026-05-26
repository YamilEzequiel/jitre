import { Test, TestingModule } from '@nestjs/testing';
import { InAppNotificationDriver } from './in-app-notification.driver';
import { NotificationService } from '../notification.service';
import { NotificationType } from '@jitre/shared';

const mockNotificationService = {
  create: jest.fn(),
};

const makeInput = () => ({
  workspaceId: 'ws-1',
  recipientUserId: 'u-1',
  type: NotificationType.WORKSPACE_INVITED,
  title: 'You were invited',
});

describe('InAppNotificationDriver', () => {
  let driver: InAppNotificationDriver;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InAppNotificationDriver,
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();
    driver = module.get(InAppNotificationDriver);
  });

  it('has name "in-app"', () => {
    expect(driver.name).toBe('in-app');
  });

  it('calls NotificationService.create with the input fields', async () => {
    mockNotificationService.create.mockResolvedValue({ id: 'n-1' });
    const input = makeInput();

    await driver.send(input);

    expect(mockNotificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'u-1',
        type: NotificationType.WORKSPACE_INVITED,
        title: 'You were invited',
      }),
    );
  });
});
