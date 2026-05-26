import { Injectable, computed, inject, signal } from '@angular/core';
import { ChatApiService, ChatMessage } from './chat-api.service';

interface ChannelMessages {
  list: ChatMessage[];
  hasMore: boolean;
  oldestId: string | null;
  loading: boolean;
}

const EMPTY: ChannelMessages = { list: [], hasMore: true, oldestId: null, loading: false };

@Injectable({ providedIn: 'root' })
export class ChatMessageStore {
  private readonly api = inject(ChatApiService);

  /** Map of channelId -> messages slice. */
  private readonly _byChannel = signal<Record<string, ChannelMessages>>({});

  readonly byChannel = this._byChannel.asReadonly();

  /** Returns a computed signal of the message list for a given channel (ASC order). */
  messagesFor(channelId: string) {
    return computed(() => this._byChannel()[channelId]?.list ?? []);
  }

  hasMore(channelId: string): boolean {
    return this._byChannel()[channelId]?.hasMore ?? true;
  }

  isLoading(channelId: string): boolean {
    return this._byChannel()[channelId]?.loading ?? false;
  }

  /** Replaces the slice for a channel. */
  setForChannel(channelId: string, messages: ChatMessage[], hasMore = false): void {
    const sorted = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    this._byChannel.update(map => ({
      ...map,
      [channelId]: {
        list: sorted,
        hasMore,
        oldestId: sorted[0]?.id ?? null,
        loading: false,
      },
    }));
  }

  upsert(message: ChatMessage): void {
    this._byChannel.update(map => {
      const slice = map[message.channelId] ?? { ...EMPTY };
      const idx = slice.list.findIndex(m => m.id === message.id);
      let list: ChatMessage[];
      if (idx === -1) {
        list = [...slice.list, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      } else {
        list = [...slice.list];
        list[idx] = message;
      }
      return {
        ...map,
        [message.channelId]: {
          ...slice,
          list,
          oldestId: list[0]?.id ?? slice.oldestId,
        },
      };
    });
  }

  remove(channelId: string, messageId: string): void {
    this._byChannel.update(map => {
      const slice = map[channelId];
      if (!slice) return map;
      return {
        ...map,
        [channelId]: { ...slice, list: slice.list.filter(m => m.id !== messageId) },
      };
    });
  }

  /** Replace a temporary optimistic message with the server one. */
  replaceTemp(channelId: string, tempId: string, real: ChatMessage): void {
    this._byChannel.update(map => {
      const slice = map[channelId];
      if (!slice) return { ...map, [channelId]: { ...EMPTY, list: [real] } };
      const list = slice.list.map(m => (m.id === tempId ? real : m));
      // dedupe if real arrived twice (via WS + HTTP)
      const dedup = list.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i);
      return { ...map, [channelId]: { ...slice, list: dedup } };
    });
  }

  clearChannel(channelId: string): void {
    this._byChannel.update(map => {
      const copy = { ...map };
      delete copy[channelId];
      return copy;
    });
  }

  clear(): void {
    this._byChannel.set({});
  }

  async loadInitial(channelId: string, limit = 50): Promise<void> {
    this._setLoading(channelId, true);
    try {
      const page = await this.api.listMessages(channelId, { limit });
      // Backend returns DESC by createdAt; we store ASC.
      this.setForChannel(channelId, page.data, page.hasMore);
    } finally {
      this._setLoading(channelId, false);
    }
  }

  async loadMore(channelId: string, limit = 50): Promise<void> {
    const slice = this._byChannel()[channelId];
    if (!slice || !slice.hasMore || slice.loading) return;
    const before = slice.oldestId ?? undefined;
    this._setLoading(channelId, true);
    try {
      const page = await this.api.listMessages(channelId, { before, limit });
      this._byChannel.update(map => {
        const cur = map[channelId] ?? { ...EMPTY };
        const merged = [...page.data, ...cur.list]
          .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return {
          ...map,
          [channelId]: {
            list: merged,
            hasMore: page.hasMore,
            oldestId: merged[0]?.id ?? null,
            loading: false,
          },
        };
      });
    } finally {
      this._setLoading(channelId, false);
    }
  }

  private _setLoading(channelId: string, loading: boolean): void {
    this._byChannel.update(map => {
      const cur = map[channelId] ?? { ...EMPTY };
      return { ...map, [channelId]: { ...cur, loading } };
    });
  }
}
