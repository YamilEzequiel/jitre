import { TestBed } from '@angular/core/testing';
import { ChatRealtimeService } from './chat-realtime.service';
import { AuthService } from '../auth/auth.service';
import { ChatMessage } from '../../stores/chat-api.service';

describe('ChatRealtimeService', () => {
  let svc: ChatRealtimeService;
  const auth = { getAccessToken: () => 'tk' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChatRealtimeService, { provide: AuthService, useValue: auth }],
    });
    svc = TestBed.inject(ChatRealtimeService);
  });

  it('starts disconnected', () => {
    expect(svc.connected()).toBe(false);
  });

  it('handlers fire when _emitForTest pushes events', () => {
    const created: ChatMessage[] = [];
    const dispose = svc.onMessageCreated(m => created.push(m));
    const message: ChatMessage = {
      id: 'm1',
      channelId: 'c1',
      authorId: 'u1',
      body: 'hello',
      parentMessageId: null,
      attachments: [],
      editedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    svc._emitForTest('messageCreated', message);
    expect(created.length).toBe(1);
    expect(created[0].id).toBe('m1');
    dispose();
    svc._emitForTest('messageCreated', message);
    expect(created.length).toBe(1);
  });

  it('typing handler receives payload', () => {
    let last: { channelId: string; userId: string; typing: boolean } | null = null;
    svc.onTyping(ev => (last = ev));
    svc._emitForTest('typing', { channelId: 'c1', userId: 'u1', typing: true });
    expect(last).toEqual({ channelId: 'c1', userId: 'u1', typing: true });
  });

  it('emit helpers are no-ops when no socket is connected', () => {
    expect(() => svc.joinChannel('c1')).not.toThrow();
    expect(() => svc.leaveChannel('c1')).not.toThrow();
    expect(() => svc.typingStart('c1')).not.toThrow();
    expect(() => svc.typingStop('c1')).not.toThrow();
  });
});
