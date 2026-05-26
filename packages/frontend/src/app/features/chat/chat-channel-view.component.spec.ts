import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ChatChannelViewComponent } from './chat-channel-view.component';
import { ChatChannelStore } from '../../stores/chat-channel.store';
import { ChatMessageStore } from '../../stores/chat-message.store';
import { ChatPresenceStore } from '../../stores/chat-presence.store';
import { ChatApiService, ChatMessage } from '../../stores/chat-api.service';
import { ChatRealtimeService } from '../../core/chat-realtime/chat-realtime.service';
import { AuthService } from '../../core/auth/auth.service';

const channel = {
  id: 'c1',
  workspaceId: 'ws1',
  name: 'general',
  description: null,
  type: 'public' as const,
  kind: 'general' as const,
  projectId: null,
  lastMessageAt: null,
  createdAt: '2026-01-01T00:00:00Z',
};

const rootMessage: ChatMessage = {
  id: 'm-root',
  channelId: 'c1',
  authorId: 'u2',
  body: 'Root message',
  parentMessageId: null,
  attachments: [],
  editedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const replyMessage: ChatMessage = {
  id: 'm-reply',
  channelId: 'c1',
  authorId: 'u3',
  body: 'Reply message',
  parentMessageId: 'm-root',
  attachments: [],
  editedAt: null,
  createdAt: '2026-01-01T00:05:00Z',
  updatedAt: '2026-01-01T00:05:00Z',
};

describe('ChatChannelViewComponent', () => {
  let fixture: ComponentFixture<ChatChannelViewComponent>;
  let component: ChatChannelViewComponent;

  const byId = signal<Record<string, typeof channel>>({ c1: channel });
  const byChannel = signal({
    c1: { list: [rootMessage, replyMessage], hasMore: false, oldestId: 'm-root', loading: false },
  });

  const channelStore = {
    byId: byId.asReadonly(),
    clearUnread: vi.fn(),
    incrementUnread: vi.fn(),
    upsert: vi.fn(),
  };

  const messageStore = {
    byChannel: byChannel.asReadonly(),
    hasMore: vi.fn().mockReturnValue(false),
    loadInitial: vi.fn().mockResolvedValue(undefined),
    loadMore: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn(),
    replaceTemp: vi.fn(),
    remove: vi.fn(),
  };

  const presenceStore = {
    typingIn: vi.fn().mockReturnValue(signal([]).asReadonly()),
    setTyping: vi.fn(),
    setOnline: vi.fn(),
  };

  const chatApi = {
    getChannel: vi.fn().mockResolvedValue(channel),
    sendMessage: vi.fn().mockResolvedValue({
      ...replyMessage,
      id: 'm-reply-2',
      body: 'Looks good',
      parentMessageId: 'm-root',
      authorId: 'u1',
      createdAt: '2026-01-01T00:06:00Z',
      updatedAt: '2026-01-01T00:06:00Z',
    }),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    markAsRead: vi.fn().mockResolvedValue(undefined),
  };

  const realtime = {
    joinChannel: vi.fn(),
    leaveChannel: vi.fn(),
    typingStart: vi.fn(),
    typingStop: vi.fn(),
    onMessageCreated: vi.fn().mockReturnValue(() => undefined),
    onMessageEdited: vi.fn().mockReturnValue(() => undefined),
    onMessageDeleted: vi.fn().mockReturnValue(() => undefined),
    onTyping: vi.fn().mockReturnValue(() => undefined),
    onPresence: vi.fn().mockReturnValue(() => undefined),
  };

  const auth = {
    currentUser: signal({ id: 'u1', email: 'u1@x', displayName: 'U1', role: 'member' }).asReadonly(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [ChatChannelViewComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: { subscribe: (fn: (v: { get: (k: string) => string }) => void) => { fn({ get: () => 'c1' }); return { unsubscribe() {} }; } } } },
        { provide: ChatChannelStore, useValue: channelStore },
        { provide: ChatMessageStore, useValue: messageStore },
        { provide: ChatPresenceStore, useValue: presenceStore },
        { provide: ChatApiService, useValue: chatApi },
        { provide: ChatRealtimeService, useValue: realtime },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatChannelViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('opens a side panel thread when reply is selected', () => {
    component.openThread(rootMessage);
    expect(component.activeThreadRoot()?.id).toBe('m-root');
    expect(component.threadMessages().map(m => m.id)).toEqual(['m-reply']);
  });

  it('sends thread replies with parentMessageId', async () => {
    component.openThread(rootMessage);
    await component.onSendThreadReply('Looks good');

    expect(chatApi.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'c1',
        body: 'Looks good',
        parentMessageId: 'm-root',
      }),
    );
    expect(messageStore.replaceTemp).toHaveBeenCalled();
  });
});
