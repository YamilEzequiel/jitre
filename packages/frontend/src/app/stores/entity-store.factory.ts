import { computed, signal } from '@angular/core';

export interface EntityEvent {
  type: 'created' | 'updated' | 'deleted';
  id: string;
}

export interface EntityStore<T extends { id: string }> {
  items: ReturnType<typeof signal<T[]>>;
  byId: ReturnType<typeof computed<Record<string, T>>>;
  loading: ReturnType<typeof signal<boolean>>;
  error: ReturnType<typeof signal<string | null>>;
  load: (items: T[]) => void;
  upsert: (item: T) => void;
  upsertMany: (items: T[]) => void;
  remove: (id: string) => void;
  clear: () => void;
  setRefetcher: (fn: (id: string) => Promise<T>) => void;
  applyEvent: (event: EntityEvent) => Promise<void>;
}

export function createEntityStore<T extends { id: string }>(): EntityStore<T> {
  const items = signal<T[]>([]);
  const loading = signal(false);
  const error = signal<string | null>(null);

  const byId = computed<Record<string, T>>(() => {
    const map: Record<string, T> = {};
    for (const item of items()) {
      map[item.id] = item;
    }
    return map;
  });

  let refetcher: ((id: string) => Promise<T>) | null = null;

  const load = (newItems: T[]): void => {
    items.set([...newItems]);
  };

  const upsert = (item: T): void => {
    items.update(current => {
      const idx = current.findIndex(i => i.id === item.id);
      if (idx === -1) return [...current, item];
      const updated = [...current];
      updated[idx] = item;
      return updated;
    });
  };

  const upsertMany = (newItems: T[]): void => {
    for (const item of newItems) upsert(item);
  };

  const remove = (id: string): void => {
    items.update(current => current.filter(i => i.id !== id));
  };

  const clear = (): void => {
    items.set([]);
  };

  const setRefetcher = (fn: (id: string) => Promise<T>): void => {
    refetcher = fn;
  };

  const applyEvent = async (event: EntityEvent): Promise<void> => {
    if (event.type === 'deleted') {
      remove(event.id);
      return;
    }
    if (refetcher) {
      try {
        const fresh = await refetcher(event.id);
        upsert(fresh);
      } catch (err) {
        console.warn(`[EntityStore] refetch error for id=${event.id}`, err);
      }
    }
  };

  return { items, byId, loading, error, load, upsert, upsertMany, remove, clear, setRefetcher, applyEvent };
}
