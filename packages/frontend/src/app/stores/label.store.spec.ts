import { TestBed } from '@angular/core/testing';
import { LabelStore } from './label.store';
import { LabelApiService, Label } from './label-api.service';

const labels: Label[] = [
  { id: 'l1', workspaceId: 'ws1', projectId: null, name: 'bug', scope: 'workspace', color: '#f00' },
  { id: 'l2', workspaceId: 'ws1', projectId: 'p1', name: 'urgent', scope: 'project' },
  { id: 'l3', workspaceId: 'ws1', projectId: 'p2', name: 'other', scope: 'project' },
];

describe('LabelStore', () => {
  let store: LabelStore;
  const apiMock = {
    listWorkspace: vi.fn().mockResolvedValue([labels[0]]),
    listByProject: vi.fn().mockResolvedValue([labels[1]]),
  };

  beforeEach(() => {
    apiMock.listWorkspace.mockClear();
    apiMock.listByProject.mockClear();
    apiMock.listWorkspace.mockResolvedValue([labels[0]]);
    apiMock.listByProject.mockResolvedValue([labels[1]]);
    TestBed.configureTestingModule({
      providers: [
        LabelStore,
        { provide: LabelApiService, useValue: apiMock },
      ],
    });
    store = TestBed.inject(LabelStore);
    store.load(labels);
  });

  it('byScope filters by scope', () => {
    expect(store.byScope('workspace')().length).toBe(1);
    expect(store.byScope('project')().length).toBe(2);
  });

  it('byProject returns project-scoped + workspace labels', () => {
    const p1 = store.byProject('p1')();
    expect(p1.map(l => l.id).sort()).toEqual(['l1', 'l2']);
  });

  it('byId returns label by id', () => {
    expect(store.byId()['l2']?.name).toBe('urgent');
  });

  it('loadWorkspace fetches workspace labels', async () => {
    store.clear();
    await store.loadWorkspace();
    expect(apiMock.listWorkspace).toHaveBeenCalled();
    expect(store.items().length).toBe(1);
  });

  it('loadForProject fetches and replaces project slice', async () => {
    await store.loadForProject('p1');
    expect(apiMock.listByProject).toHaveBeenCalledWith('p1');
    // workspace label still present, p2 project label preserved
    expect(store.items().some(l => l.id === 'l1')).toBe(true);
    expect(store.items().some(l => l.id === 'l3')).toBe(true);
  });
});
