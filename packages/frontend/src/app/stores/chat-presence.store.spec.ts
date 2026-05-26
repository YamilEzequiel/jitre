import { TestBed } from '@angular/core/testing';
import { ChatPresenceStore } from './chat-presence.store';

describe('ChatPresenceStore', () => {
  let store: ChatPresenceStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ChatPresenceStore] });
    store = TestBed.inject(ChatPresenceStore);
  });

  it('setOnline toggles membership', () => {
    store.setOnline('u1', true);
    store.setOnline('u2', true);
    expect(store.isOnline('u1')).toBe(true);
    expect(store.isOnline('u2')).toBe(true);
    store.setOnline('u1', false);
    expect(store.isOnline('u1')).toBe(false);
    expect(store.isOnline('u2')).toBe(true);
  });

  it('setTyping registers and clears typing for a channel/user', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000_000));
    store.setTyping('c1', 'u1', true, 1_000_000);
    store.setTyping('c1', 'u2', true, 1_000_000);
    expect(store.typingIn('c1')().sort()).toEqual(['u1', 'u2']);
    store.setTyping('c1', 'u1', false, 1_000_000);
    expect(store.typingIn('c1')()).toEqual(['u2']);
    vi.useRealTimers();
  });

  it('expired typing entries are pruned by TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000_000));
    store.setTyping('c1', 'u1', true, 1_000_000);
    expect(store.typingIn('c1')()).toEqual(['u1']);
    // jump 10s ahead — past TTL of 6s
    vi.setSystemTime(new Date(1_010_000));
    expect(store.typingIn('c1')()).toEqual([]);
    vi.useRealTimers();
  });

  it('clear resets both online and typing', () => {
    store.setOnline('u1', true);
    store.setTyping('c1', 'u1', true);
    store.clear();
    expect(store.online().size).toBe(0);
    expect(store.typing().length).toBe(0);
  });
});
