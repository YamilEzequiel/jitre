import { Injectable, computed, inject, signal } from '@angular/core';
import { createEntityStore } from './entity-store.factory';
import { ChatApiService, ChatChannel } from './chat-api.service';

@Injectable({ providedIn: 'root' })
export class ChatChannelStore {
  private readonly api = inject(ChatApiService);
  private readonly store = createEntityStore<ChatChannel>();

  readonly items = this.store.items;
  readonly byId = this.store.byId;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  /** Unread counts per channel id. */
  private readonly _unread = signal<Record<string, number>>({});
  readonly unread = this._unread.asReadonly();

  readonly totalUnread = computed(() => {
    let total = 0;
    const map = this._unread();
    for (const id in map) total += map[id] ?? 0;
    return total;
  });

  readonly channels = computed(() =>
    this.items().filter(c => c.type === 'public' || c.type === 'private'),
  );

  readonly dms = computed(() => this.items().filter(c => c.type === 'dm'));

  constructor() {
    this.store.setRefetcher(id => this.api.getChannel(id));
  }

  load(channels: ChatChannel[]): void {
    this.store.load(channels);
  }

  upsert(channel: ChatChannel): void {
    this.store.upsert(channel);
  }

  remove(id: string): void {
    this.store.remove(id);
    this._unread.update(map => {
      const copy = { ...map };
      delete copy[id];
      return copy;
    });
  }

  clear(): void {
    this.store.clear();
    this._unread.set({});
  }

  setUnread(channelId: string, count: number): void {
    this._unread.update(map => ({ ...map, [channelId]: count }));
  }

  incrementUnread(channelId: string): void {
    this._unread.update(map => ({ ...map, [channelId]: (map[channelId] ?? 0) + 1 }));
  }

  clearUnread(channelId: string): void {
    this._unread.update(map => ({ ...map, [channelId]: 0 }));
  }

  unreadFor(channelId: string): number {
    return this._unread()[channelId] ?? 0;
  }

  async refresh(): Promise<void> {
    this.store.loading.set(true);
    this.store.error.set(null);
    try {
      const list = await this.api.listChannels();
      this.store.load(list);
      // best-effort populate unread counts
      const counts: Record<string, number> = {};
      await Promise.all(
        list.map(async c => {
          try {
            counts[c.id] = await this.api.getUnreadCount(c.id);
          } catch {
            counts[c.id] = 0;
          }
        }),
      );
      this._unread.set(counts);
    } catch (err) {
      this.store.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.store.loading.set(false);
    }
  }
}
