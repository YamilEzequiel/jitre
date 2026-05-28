import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationListComponent } from './notification-list.component';
import { NotificationStore } from '../../stores/notification.store';
import { NotificationApiService } from '../../stores/notification-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { signal, computed } from '@angular/core';

const mockNotifications = [
  { id: 'n1', message: 'Task assigned', type: 'task', readAt: null, workspaceId: 'ws1', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'n2', message: 'Comment added', type: 'comment', readAt: '2026-01-02T00:00:00Z', workspaceId: 'ws1', createdAt: '2026-01-02T00:00:00Z' },
];

describe('NotificationListComponent', () => {
  let fixture: ComponentFixture<NotificationListComponent>;
  const itemsSignal = signal(mockNotifications);
  let apiMock: { markAsRead: ReturnType<typeof vi.fn>; markAllAsRead: ReturnType<typeof vi.fn> };
  let storeMock: { items: typeof itemsSignal; unreadCount: ReturnType<typeof computed>; markAsRead: ReturnType<typeof vi.fn> };
  let authMock: { currentWorkspace: ReturnType<typeof signal>; currentUser: ReturnType<typeof signal>; isAuthenticated: ReturnType<typeof computed> };

  beforeEach(() => {
    apiMock = {
      markAsRead: vi.fn().mockResolvedValue({}),
      markAllAsRead: vi.fn().mockResolvedValue(undefined),
    };
    storeMock = {
      items: itemsSignal,
      unreadCount: computed(() => 1),
      markAsRead: vi.fn(),
    };
    authMock = {
      currentWorkspace: signal({ id: 'ws1', name: 'Test Workspace', slug: 'test' }),
      currentUser: signal({ id: 'u1', email: 'a@b.com', role: 'member', name: 'User' }),
      isAuthenticated: computed(() => true),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationStore, useValue: storeMock },
        { provide: NotificationApiService, useValue: apiMock },
        { provide: AuthService, useValue: authMock },
      ],
    });

    fixture = TestBed.createComponent(NotificationListComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('exposes notifications from the store', () => {
    const comp = fixture.componentInstance;
    const messages = comp.store.items().map(n => n.message);
    expect(messages).toContain('Task assigned');
    expect(messages).toContain('Comment added');
  });

  it('markAsRead calls store and api', async () => {
    const comp = fixture.componentInstance;
    await comp.markAsRead('n1');
    expect(apiMock.markAsRead).toHaveBeenCalledWith('n1');
  });

  it('markAllAsRead uses workspaceId from auth', async () => {
    const comp = fixture.componentInstance;
    await comp.markAllAsRead();
    expect(apiMock.markAllAsRead).toHaveBeenCalledWith('ws1');
  });
});
