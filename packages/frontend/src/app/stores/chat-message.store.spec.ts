import { TestBed } from '@angular/core/testing';
import { ChatMessageStore } from './chat-message.store';
import { ChatApiService, ChatMessage } from './chat-api.service';

function msg(id: string, channelId: string, createdAt: string): ChatMessage {
  return {
    id,
    channelId,
    authorId: 'u1',
    body: id,
    parentMessageId: null,
    attachments: [],
    editedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('ChatMessageStore', () => {
  let store: ChatMessageStore;
  const api = {
    listMessages: vi.fn(),
    sendMessage: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    getChannel: vi.fn(),
    listChannels: vi.fn(),
    createChannel: vi.fn(),
    updateChannel: vi.fn(),
    deleteChannel: vi.fn(),
    openOrCreateDM: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    markAsRead: vi.fn(),
    search: vi.fn(),
    getUnreadCount: vi.fn(),
  };

  beforeEach(() => {
    Object.values(api).forEach(fn => (fn as any).mockReset?.());
    TestBed.configureTestingModule({
      providers: [ChatMessageStore, { provide: ChatApiService, useValue: api }],
    });
    store = TestBed.inject(ChatMessageStore);
  });

  it('setForChannel sorts ASC by createdAt and tracks oldestId', () => {
    store.setForChannel('c1', [
      msg('b', 'c1', '2026-01-02T00:00:00Z'),
      msg('a', 'c1', '2026-01-01T00:00:00Z'),
      msg('c', 'c1', '2026-01-03T00:00:00Z'),
    ], true);
    const list = store.messagesFor('c1')();
    expect(list.map(m => m.id)).toEqual(['a', 'b', 'c']);
    expect(store.hasMore('c1')).toBe(true);
  });

  it('upsert inserts new and updates existing in place', () => {
    store.setForChannel('c1', [msg('a', 'c1', '2026-01-01T00:00:00Z')]);
    store.upsert(msg('b', 'c1', '2026-01-02T00:00:00Z'));
    store.upsert({ ...msg('a', 'c1', '2026-01-01T00:00:00Z'), body: 'edited' });
    const list = store.messagesFor('c1')();
    expect(list.length).toBe(2);
    expect(list.find(m => m.id === 'a')?.body).toBe('edited');
  });

  it('loadInitial calls api with limit and stores results', async () => {
    api.listMessages.mockResolvedValueOnce({
      data: [msg('a', 'c1', '2026-01-01T00:00:00Z'), msg('b', 'c1', '2026-01-02T00:00:00Z')],
      hasMore: true,
      nextCursor: null,
    });
    await store.loadInitial('c1', 30);
    expect(api.listMessages).toHaveBeenCalledWith('c1', { limit: 30 });
    expect(store.messagesFor('c1')().length).toBe(2);
    expect(store.hasMore('c1')).toBe(true);
  });

  it('loadMore prepends older messages and dedupes by id', async () => {
    store.setForChannel('c1', [msg('b', 'c1', '2026-01-02T00:00:00Z')], true);
    api.listMessages.mockResolvedValueOnce({
      data: [
        msg('a', 'c1', '2026-01-01T00:00:00Z'),
        msg('b', 'c1', '2026-01-02T00:00:00Z'),
      ],
      hasMore: false,
      nextCursor: null,
    });
    await store.loadMore('c1');
    const list = store.messagesFor('c1')();
    expect(list.map(m => m.id)).toEqual(['a', 'b']);
    expect(store.hasMore('c1')).toBe(false);
  });

  it('replaceTemp swaps the optimistic id for the real one', () => {
    const temp = msg('temp-1', 'c1', '2026-01-01T00:00:00Z');
    store.setForChannel('c1', [temp]);
    const real = { ...temp, id: 'real-1' };
    store.replaceTemp('c1', 'temp-1', real);
    const list = store.messagesFor('c1')();
    expect(list.map(m => m.id)).toEqual(['real-1']);
  });

  it('remove deletes a single message from the channel', () => {
    store.setForChannel('c1', [
      msg('a', 'c1', '2026-01-01T00:00:00Z'),
      msg('b', 'c1', '2026-01-02T00:00:00Z'),
    ]);
    store.remove('c1', 'a');
    expect(store.messagesFor('c1')().map(m => m.id)).toEqual(['b']);
  });
});
