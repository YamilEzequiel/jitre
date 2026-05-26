import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentStore } from './document.store';
import { Document, DocumentApiService } from './document-api.service';

function makeDoc(over: Partial<Document> = {}): Document {
  return {
    id: 'd1',
    workspaceId: 'ws1',
    projectId: null,
    parentId: null,
    title: 'Doc 1',
    icon: null,
    content: {},
    contentText: '',
    order: 0,
    creatorUserId: 'u1',
    lastEditedByUserId: 'u1',
    lastEditedAt: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    children: [],
    ...over,
  };
}

describe('DocumentStore', () => {
  let store: DocumentStore;
  const api = {
    tree: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    move: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    api.tree.mockReset();
    api.list.mockReset();
    api.getById.mockReset();
    api.create.mockReset();
    api.update.mockReset();
    api.move.mockReset();
    api.delete.mockReset();

    TestBed.configureTestingModule({
      providers: [
        DocumentStore,
        { provide: DocumentApiService, useValue: api },
      ],
    });
    store = TestBed.inject(DocumentStore);
  });

  it('loadTree stores roots and indexes nested children in byId', async () => {
    const child = makeDoc({ id: 'c1', parentId: 'r1', title: 'Child' });
    const root = makeDoc({ id: 'r1', title: 'Root', children: [child] });
    api.tree.mockResolvedValue([root]);

    await store.loadTree();

    expect(store.tree()).toHaveLength(1);
    expect(store.byId()['r1']?.title).toBe('Root');
    expect(store.byId()['c1']?.title).toBe('Child');
  });

  it('loadTree forwards projectId filter to the API', async () => {
    api.tree.mockResolvedValue([]);
    await store.loadTree('proj-9');
    expect(api.tree).toHaveBeenCalledWith('proj-9');
  });

  it('loadTree sets loading then clears it', async () => {
    api.tree.mockResolvedValue([]);
    const p = store.loadTree();
    expect(store.loading()).toBe(true);
    await p;
    expect(store.loading()).toBe(false);
  });

  it('loadTree captures error message on failure', async () => {
    api.tree.mockRejectedValue(new Error('boom'));
    await expect(store.loadTree()).rejects.toThrow('boom');
    expect(store.error()).toBe('boom');
    expect(store.loading()).toBe(false);
  });

  it('loadById fetches and upserts the doc', async () => {
    const doc = makeDoc({ id: 'x9', title: 'Loaded' });
    api.getById.mockResolvedValue(doc);

    const result = await store.loadById('x9');

    expect(api.getById).toHaveBeenCalledWith('x9');
    expect(result).toEqual(doc);
    expect(store.byId()['x9']?.title).toBe('Loaded');
  });

  it('upsert adds a new doc to byId', () => {
    const doc = makeDoc({ id: 'new1', title: 'Fresh' });
    store.upsert(doc);
    expect(store.byId()['new1']?.title).toBe('Fresh');
  });

  it('upsert updates an existing doc in byId', () => {
    const doc = makeDoc({ id: 'd5', title: 'Old' });
    store.upsert(doc);
    store.upsert({ ...doc, title: 'New' });
    expect(store.byId()['d5']?.title).toBe('New');
  });

  it('remove drops a doc from byId', () => {
    const doc = makeDoc({ id: 'd9' });
    store.upsert(doc);
    expect(store.byId()['d9']).toBeDefined();
    store.remove('d9');
    expect(store.byId()['d9']).toBeUndefined();
  });

  it('create inserts a root doc into tree and indexes it', async () => {
    const created = makeDoc({ id: 'r2', title: 'Created', parentId: null });
    api.create.mockResolvedValue(created);

    await store.create({ title: 'Created' });

    expect(store.tree().some(n => n.id === 'r2')).toBe(true);
    expect(store.byId()['r2']?.title).toBe('Created');
  });

  it('create attaches a child to the parent node in the tree', async () => {
    const root = makeDoc({ id: 'r1', title: 'Root', children: [] });
    api.tree.mockResolvedValue([root]);
    await store.loadTree();

    const child = makeDoc({ id: 'c1', title: 'Kid', parentId: 'r1' });
    api.create.mockResolvedValue(child);

    await store.create({ title: 'Kid', parentId: 'r1' });

    expect(store.tree()[0].children?.some(c => c.id === 'c1')).toBe(true);
  });

  it('update patches a tree node in place', async () => {
    const root = makeDoc({ id: 'r1', title: 'Old', children: [] });
    api.tree.mockResolvedValue([root]);
    await store.loadTree();

    const updated = { ...root, title: 'New' };
    api.update.mockResolvedValue(updated);

    await store.update('r1', { title: 'New' });

    expect(store.tree()[0].title).toBe('New');
    expect(store.byId()['r1']?.title).toBe('New');
  });

  it('delete removes from tree and byId', async () => {
    const child = makeDoc({ id: 'c1', parentId: 'r1' });
    const root = makeDoc({ id: 'r1', children: [child] });
    api.tree.mockResolvedValue([root]);
    await store.loadTree();
    api.delete.mockResolvedValue(undefined);

    await store.delete('c1');

    expect(store.tree()[0].children?.length ?? 0).toBe(0);
    expect(store.byId()['c1']).toBeUndefined();
  });

  it('delete evicts descendants from byId when a parent page is deleted', async () => {
    const grandchild = makeDoc({ id: 'g1', parentId: 'c1' });
    const child = makeDoc({ id: 'c1', parentId: 'r1', children: [grandchild] });
    const root = makeDoc({ id: 'r1', children: [child] });
    api.tree.mockResolvedValue([root]);
    await store.loadTree();
    api.delete.mockResolvedValue(undefined);

    await store.delete('r1');

    expect(store.tree()).toEqual([]);
    expect(store.byId()['r1']).toBeUndefined();
    expect(store.byId()['c1']).toBeUndefined();
    expect(store.byId()['g1']).toBeUndefined();
  });

  it('search delegates to api.list with the query', async () => {
    api.list.mockResolvedValue([makeDoc({ id: 'hit' })]);
    const out = await store.search('hello', { projectId: 'p1' });
    expect(api.list).toHaveBeenCalledWith({ projectId: 'p1', q: 'hello' });
    expect(out).toHaveLength(1);
  });

  it('move calls api.move and refreshes the entity in byId', async () => {
    const doc = makeDoc({ id: 'm1', parentId: 'r2', order: 3 });
    api.move.mockResolvedValue(doc);

    await store.move('m1', { parentId: 'r2', order: 3 });

    expect(api.move).toHaveBeenCalledWith('m1', { parentId: 'r2', order: 3 });
    expect(store.byId()['m1']?.parentId).toBe('r2');
  });

  it('clear empties everything', async () => {
    api.tree.mockResolvedValue([makeDoc()]);
    await store.loadTree();
    store.clear();
    expect(store.tree()).toEqual([]);
    expect(store.byId()).toEqual({});
  });
});
