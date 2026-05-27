import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AreaStore } from './area.store';
import { Area, AreaApiService } from './area-api.service';

const fakeArea = (id: string, name = `Area ${id}`): Area => ({
  id,
  workspaceId: 'ws-1',
  name,
  color: '#7c3aed',
  icon: null,
  description: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
});

describe('AreaStore', () => {
  let store: AreaStore;
  const apiMock = { list: vi.fn() };

  beforeEach(() => {
    apiMock.list.mockReset();
    TestBed.configureTestingModule({
      providers: [
        AreaStore,
        { provide: AreaApiService, useValue: apiMock },
      ],
    });
    store = TestBed.inject(AreaStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('starts empty', () => {
    expect(store.areas()).toEqual([]);
    expect(store.byId()).toEqual({});
  });

  it('load() pulls from the api and populates the cache', async () => {
    apiMock.list.mockResolvedValue([fakeArea('a1'), fakeArea('a2')]);
    await store.load('ws-1');
    expect(apiMock.list).toHaveBeenCalledWith('ws-1');
    expect(store.areas()).toHaveLength(2);
    expect(store.byId()['a1']).toBeDefined();
  });

  it('upsert() appends new and replaces existing', () => {
    store.upsert(fakeArea('a1', 'old'));
    store.upsert(fakeArea('a1', 'new'));
    store.upsert(fakeArea('a2'));
    expect(store.areas()).toHaveLength(2);
    expect(store.byId()['a1'].name).toBe('new');
  });

  it('remove() drops the entry', () => {
    store.upsert(fakeArea('a1'));
    store.upsert(fakeArea('a2'));
    store.remove('a1');
    expect(store.areas()).toHaveLength(1);
    expect(store.byId()['a1']).toBeUndefined();
  });
});
