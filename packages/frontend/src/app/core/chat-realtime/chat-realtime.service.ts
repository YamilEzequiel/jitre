import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AuthService } from '../auth/auth.service';
import { ChatMessage } from '../../stores/chat-api.service';

const CHAT_NAMESPACE = '/chat';

export interface TypingEvent {
  channelId: string;
  userId: string;
  typing: boolean;
}

export interface PresenceEvent {
  userId: string;
  online: boolean;
}

export interface MessageDeletedEvent {
  messageId: string;
  channelId: string;
}

type EventHandler<T> = (payload: T) => void;

@Injectable({ providedIn: 'root' })
export class ChatRealtimeService implements OnDestroy {
  private readonly auth = inject(AuthService);

  private _socket: Socket | null = null;

  private readonly _connected = signal<boolean>(false);
  readonly connected = this._connected.asReadonly();

  private readonly _messageCreated = new Set<EventHandler<ChatMessage>>();
  private readonly _messageEdited = new Set<EventHandler<ChatMessage>>();
  private readonly _messageDeleted = new Set<EventHandler<MessageDeletedEvent>>();
  private readonly _typing = new Set<EventHandler<TypingEvent>>();
  private readonly _presence = new Set<EventHandler<PresenceEvent>>();

  connect(): void {
    if (this._socket) {
      this._socket.disconnect();
    }
    const token = this.auth.getAccessToken();
    this._socket = io(CHAT_NAMESPACE, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });
    this._socket.on('connect', () => this._connected.set(true));
    this._socket.on('disconnect', () => this._connected.set(false));
    this._bindEvents();
  }

  disconnect(): void {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = null;
      this._connected.set(false);
    }
  }

  joinChannel(channelId: string): void {
    this._socket?.emit('chat:join', { channelId });
  }

  leaveChannel(channelId: string): void {
    this._socket?.emit('chat:leave', { channelId });
  }

  typingStart(channelId: string): void {
    this._socket?.emit('chat:typing:start', { channelId });
  }

  typingStop(channelId: string): void {
    this._socket?.emit('chat:typing:stop', { channelId });
  }

  onMessageCreated(fn: EventHandler<ChatMessage>): () => void {
    this._messageCreated.add(fn);
    return () => this._messageCreated.delete(fn);
  }

  onMessageEdited(fn: EventHandler<ChatMessage>): () => void {
    this._messageEdited.add(fn);
    return () => this._messageEdited.delete(fn);
  }

  onMessageDeleted(fn: EventHandler<MessageDeletedEvent>): () => void {
    this._messageDeleted.add(fn);
    return () => this._messageDeleted.delete(fn);
  }

  onTyping(fn: EventHandler<TypingEvent>): () => void {
    this._typing.add(fn);
    return () => this._typing.delete(fn);
  }

  onPresence(fn: EventHandler<PresenceEvent>): () => void {
    this._presence.add(fn);
    return () => this._presence.delete(fn);
  }

  /** Test-only: simulate an incoming event so consumers can react. */
  _emitForTest<T>(
    bucket: 'messageCreated' | 'messageEdited' | 'messageDeleted' | 'typing' | 'presence',
    payload: T,
  ): void {
    const map = {
      messageCreated: this._messageCreated,
      messageEdited: this._messageEdited,
      messageDeleted: this._messageDeleted,
      typing: this._typing,
      presence: this._presence,
    } as const;
    const set = map[bucket] as Set<EventHandler<T>>;
    for (const fn of set) fn(payload);
  }

  private _bindEvents(): void {
    if (!this._socket) return;
    this._socket.on('chat:message:created', (payload: { message: ChatMessage } | ChatMessage) => {
      const msg = 'message' in payload ? payload.message : payload;
      for (const fn of this._messageCreated) fn(msg);
    });
    this._socket.on('chat:message:edited', (payload: { message: ChatMessage } | ChatMessage) => {
      const msg = 'message' in payload ? payload.message : payload;
      for (const fn of this._messageEdited) fn(msg);
    });
    this._socket.on('chat:message:deleted', (payload: MessageDeletedEvent) => {
      for (const fn of this._messageDeleted) fn(payload);
    });
    this._socket.on('chat:typing', (payload: TypingEvent) => {
      for (const fn of this._typing) fn(payload);
    });
    this._socket.on('chat:presence', (payload: PresenceEvent) => {
      for (const fn of this._presence) fn(payload);
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
