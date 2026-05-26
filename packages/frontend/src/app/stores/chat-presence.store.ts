import { Injectable, computed, signal } from '@angular/core';

interface TypingEntry {
  userId: string;
  channelId: string;
  expiresAt: number;
}

const TYPING_TTL_MS = 6000;

@Injectable({ providedIn: 'root' })
export class ChatPresenceStore {
  private readonly _online = signal<Set<string>>(new Set());
  private readonly _typing = signal<TypingEntry[]>([]);

  readonly online = this._online.asReadonly();
  readonly typing = this._typing.asReadonly();

  setOnline(userId: string, online: boolean): void {
    this._online.update(s => {
      const next = new Set(s);
      if (online) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  isOnline(userId: string): boolean {
    return this._online().has(userId);
  }

  setTyping(channelId: string, userId: string, typing: boolean, now = Date.now()): void {
    this._typing.update(list => {
      const without = list.filter(
        t => !(t.channelId === channelId && t.userId === userId) && t.expiresAt > now,
      );
      if (typing) {
        without.push({ channelId, userId, expiresAt: now + TYPING_TTL_MS });
      }
      return without;
    });
  }

  typingIn(channelId: string) {
    return computed(() => {
      const now = Date.now();
      return this._typing()
        .filter(t => t.channelId === channelId && t.expiresAt > now)
        .map(t => t.userId);
    });
  }

  /** Prune expired entries (call from timer if desired). */
  prune(now = Date.now()): void {
    this._typing.update(list => list.filter(t => t.expiresAt > now));
  }

  clear(): void {
    this._online.set(new Set());
    this._typing.set([]);
  }
}
