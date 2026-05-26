import { TestBed } from '@angular/core/testing';
import { NotificationStore } from './notification.store';
import { NotificationApiService, Notification } from './notification-api.service';

const notifications: Notification[] = [
  { id: 'n1', message: 'Msg1', type: 'mention', readAt: null, workspaceId: 'ws1', createdAt: '2024-01-01' },
  { id: 'n2', message: 'Msg2', type: 'task', readAt: '2024-01-02', workspaceId: 'ws1', createdAt: '2024-01-01' },
  { id: 'n3', message: 'Msg3', type: 'comment', readAt: null, workspaceId: 'ws1', createdAt: '2024-01-01' },
];

describe('NotificationStore', () => {
  let store: NotificationStore;
  const mockApi = {
    getById: vi.fn(),
    list: vi.fn().mockResolvedValue(notifications),
    markAsRead: vi.fn().mockResolvedValue({ ...notifications[0], readAt: new Date().toISOString() }),
    markAllAsRead: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NotificationStore,
        { provide: NotificationApiService, useValue: mockApi },
      ],
    });
    store = TestBed.inject(NotificationStore);
    store.load(notifications);
  });

  it('unreadCount computed counts notifications without readAt', () => {
    expect(store.unreadCount()).toBe(2);
  });

  it('markAsRead updates the notification in the store', async () => {
    const readAt = new Date().toISOString();
    mockApi.markAsRead.mockResolvedValue({ ...notifications[0], readAt });
    await store.markAsRead('n1');
    expect(mockApi.markAsRead).toHaveBeenCalledWith('n1');
  });

  it('workspace switch clears and reloads notifications', async () => {
    await store.onWorkspaceSwitch('ws2');
    expect(mockApi.list).toHaveBeenCalledWith('ws2');
  });
});
