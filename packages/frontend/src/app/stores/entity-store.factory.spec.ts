import { TestBed } from '@angular/core/testing';
import { createEntityStore } from './entity-store.factory';

interface TestEntity {
  id: string;
  name: string;
}

describe('createEntityStore<T> factory', () => {
  it('load populates items and byId', async () => {
    const store = TestBed.runInInjectionContext(() => createEntityStore<TestEntity>());
    const items: TestEntity[] = [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ];
    store.load(items);
    expect(store.items()).toHaveLength(2);
    expect(store.byId()['1']).toEqual({ id: '1', name: 'A' });
  });

  it('upsert inserts new entity and replaces existing', () => {
    const store = TestBed.runInInjectionContext(() => createEntityStore<TestEntity>());
    store.upsert({ id: '1', name: 'A' });
    expect(store.items()).toHaveLength(1);
    store.upsert({ id: '1', name: 'Updated' });
    expect(store.items()).toHaveLength(1);
    expect(store.items()[0].name).toBe('Updated');
  });

  it('remove filters entity by id', () => {
    const store = TestBed.runInInjectionContext(() => createEntityStore<TestEntity>());
    store.load([{ id: '1', name: 'A' }, { id: '2', name: 'B' }]);
    store.remove('1');
    expect(store.items()).toHaveLength(1);
    expect(store.items()[0].id).toBe('2');
  });

  it('byId is a computed Map of id → entity', () => {
    const store = TestBed.runInInjectionContext(() => createEntityStore<TestEntity>());
    store.load([{ id: 'x', name: 'X' }]);
    expect(store.byId()['x']).toBeDefined();
    expect(store.byId()['missing']).toBeUndefined();
  });

  it('clear empties items', () => {
    const store = TestBed.runInInjectionContext(() => createEntityStore<TestEntity>());
    store.load([{ id: '1', name: 'A' }]);
    store.clear();
    expect(store.items()).toHaveLength(0);
  });

  it('applyEvent created/updated calls refetcher', async () => {
    const store = TestBed.runInInjectionContext(() => createEntityStore<TestEntity>());
    const refetcher = vi.fn().mockResolvedValue({ id: '1', name: 'Fetched' });
    store.setRefetcher(refetcher);
    await store.applyEvent({ type: 'created', id: '1' });
    expect(refetcher).toHaveBeenCalledWith('1');
    expect(store.byId()['1']?.name).toBe('Fetched');
  });

  it('applyEvent deleted calls remove', async () => {
    const store = TestBed.runInInjectionContext(() => createEntityStore<TestEntity>());
    store.load([{ id: '1', name: 'A' }]);
    await store.applyEvent({ type: 'deleted', id: '1' });
    expect(store.items()).toHaveLength(0);
  });

  it('refetcher error is swallowed (logs only, no throw)', async () => {
    const store = TestBed.runInInjectionContext(() => createEntityStore<TestEntity>());
    const errorRefetcher = vi.fn().mockRejectedValue(new Error('network error'));
    store.setRefetcher(errorRefetcher);
    // Should NOT throw
    await expect(store.applyEvent({ type: 'created', id: '1' })).resolves.not.toThrow();
  });
});
