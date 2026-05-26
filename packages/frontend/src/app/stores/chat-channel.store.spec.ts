import { TestBed } from '@angular/core/testing';
import { ChatChannelStore } from './chat-channel.store';
import { ChatApiService, ChatChannel } from './chat-api.service';

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
    name: 'design',
    description: 'design talk',
    type: 'private',
    kind: 'project',
    projectId: 'p1',
    lastMessageAt: null,
    createdAt: '2026-01-01T00:00:00Z',
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

describe('ChatChannelStore', () => {
  let store: ChatChannelStore;
  const api = {
    getChannel: vi.fn(),
    listChannels: vi.fn().mockResolvedValue(channels),
    getUnreadCount: vi.fn().mockResolvedValue(0),
  };

  beforeEach(() => {
    api.listChannels.mockClear();
    api.getUnreadCount.mockClear();
    api.getChannel.mockClear();
    TestBed.configureTestingModule({
      providers: [ChatChannelStore, { provide: ChatApiService, useValue: api }],
    });
    store = TestBed.inject(ChatChannelStore);
  });

  it('load + channels/dms split items by type', () => {
    store.load(channels);
    expect(store.items().length).toBe(3);
    expect(store.channels().map(c => c.id).sort()).toEqual(['c1', 'c2']);
    expect(store.dms().map(c => c.id)).toEqual(['dm1']);
  });

  it('unread tracking: set, increment, clear, total', () => {
    store.load(channels);
    store.setUnread('c1', 2);
    store.incrementUnread('c1');
    store.incrementUnread('c2');
    expect(store.unreadFor('c1')).toBe(3);
    expect(store.unreadFor('c2')).toBe(1);
    expect(store.totalUnread()).toBe(4);
    store.clearUnread('c1');
    expect(store.unreadFor('c1')).toBe(0);
    expect(store.totalUnread()).toBe(1);
  });

  it('upsert adds a new channel without removing others', () => {
    store.load([channels[0]]);
    store.upsert({ ...channels[1] });
    expect(store.items().length).toBe(2);
  });

  it('remove drops the channel and its unread', () => {
    store.load(channels);
    store.setUnread('c1', 5);
    store.remove('c1');
    expect(store.byId()['c1']).toBeUndefined();
    expect(store.unreadFor('c1')).toBe(0);
  });

  it('refresh loads channels and fetches unread counts', async () => {
    api.getUnreadCount.mockImplementation((id: string) =>
      Promise.resolve(id === 'c1' ? 4 : 0),
    );
    await store.refresh();
    expect(api.listChannels).toHaveBeenCalled();
    expect(store.items().length).toBe(3);
    expect(store.unreadFor('c1')).toBe(4);
    expect(store.totalUnread()).toBe(4);
  });
});
