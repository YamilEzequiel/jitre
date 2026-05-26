import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ChatComponent } from './chat.component';
import { ChatApiService, ChatChannel } from '../../stores/chat-api.service';
import { ChatChannelStore } from '../../stores/chat-channel.store';
import { ChatRealtimeService } from '../../core/chat-realtime/chat-realtime.service';
import { AuthService } from '../../core/auth/auth.service';

const channels: ChatChannel[] = [
  {
    id: 'c1',
    workspaceId: 'ws1',
    name: 'general',
    description: null,
    type: 'public',
    kind: 'general',
    projectId: null,
    lastMessageAt: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c2',
    workspaceId: 'ws1',
    name: 'platform',
    description: null,
    type: 'private',
    kind: 'project',
    projectId: 'p1',
    lastMessageAt: null,
    createdAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 'dm1',
    workspaceId: 'ws1',
    name: 'dm:u1:u2',
    description: null,
    type: 'dm',
    kind: 'dm',
    projectId: null,
    lastMessageAt: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('ChatComponent', () => {
  let fixture: ComponentFixture<ChatComponent>;
  let component: ChatComponent;
  let store: ChatChannelStore;
  const router = { navigate: vi.fn().mockResolvedValue(true), url: '/chat' };
  const realtime = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinChannel: vi.fn(),
    leaveChannel: vi.fn(),
  };
  const api = {
    listChannels: vi.fn().mockResolvedValue(channels),
    getUnreadCount: vi.fn().mockResolvedValue(0),
    getChannel: vi.fn(),
    search: vi.fn().mockResolvedValue([]),
    createChannel: vi.fn(),
    updateChannel: vi.fn(),
    deleteChannel: vi.fn(),
    openOrCreateDM: vi.fn(),
    listWorkspaceContacts: vi.fn().mockResolvedValue([
      { userId: 'u2', displayName: 'Maya R.', email: 'maya@x', avatarUrl: null, role: 'member' },
    ]),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    listMessages: vi.fn(),
    sendMessage: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    markAsRead: vi.fn(),
  };
  const auth = {
    currentUser: signal({ id: 'u1', email: 'u1@x', displayName: 'U1', role: 'member' }).asReadonly(),
    currentWorkspace: signal({ id: 'ws1', name: 'Workspace', slug: 'workspace' }).asReadonly(),
    getAccessToken: () => 'tk',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ChatApiService, useValue: api },
        { provide: ChatRealtimeService, useValue: realtime },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    store = TestBed.inject(ChatChannelStore);
    store.load(channels);
    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders channels and dms from the store', () => {
    expect(component.channels().map(c => c.id)).toEqual(['c1', 'c2']);
    expect(component.dms().map(c => c.id)).toEqual(['dm1']);
  });

  it('keeps #general first and project channels after it', () => {
    expect(component.channels().map(c => [c.kind, c.projectId])).toEqual([
      ['general', null],
      ['project', 'p1'],
    ]);
  });

  it('selectChannel navigates to /chat/:id', () => {
    component.selectChannel('c1');
    expect(router.navigate).toHaveBeenCalledWith(['/chat', 'c1']);
    expect(component.selectedId()).toBe('c1');
  });

  it('dmLabel resolves the workspace contact display name for a dm', () => {
    const dm = channels[2];
    expect(component.dmLabel(dm)).toBe('Maya R.');
  });

  it('starts a direct message from a workspace contact', async () => {
    const dm = channels[2];
    api.openOrCreateDM.mockResolvedValueOnce(dm);
    router.navigate.mockClear();

    await component.startDirectMessage({
      userId: 'u2',
      displayName: 'Maya R.',
      email: 'maya@x',
      avatarUrl: null,
      role: 'member',
    });

    expect(api.openOrCreateDM).toHaveBeenCalledWith('u2');
    expect(router.navigate).toHaveBeenCalledWith(['/chat', 'dm1']);
  });

  it('onChannelCreated upserts and navigates to the new channel', () => {
    const fresh: ChatChannel = {
      id: 'cnew',
      workspaceId: 'ws1',
      name: 'newone',
      description: null,
      type: 'public',
      kind: 'custom',
      projectId: null,
      lastMessageAt: null,
      createdAt: '2026-01-01T00:00:00Z',
    };
    component.onChannelCreated(fresh);
    expect(store.byId()['cnew']).toBeDefined();
    expect(router.navigate).toHaveBeenCalledWith(['/chat', 'cnew']);
  });

  it('unreadFor exposes channel-level unread counts', () => {
    store.setUnread('c1', 7);
    expect(component.unreadFor('c1')).toBe(7);
  });
});
