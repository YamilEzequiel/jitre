import { TestBed } from '@angular/core/testing';
import { WorkflowStatusStore } from './workflow-status.store';
import { WorkflowStatusApiService, WorkflowStatus } from './workflow-status-api.service';

const statuses: WorkflowStatus[] = [
  { id: 's1', projectId: 'p1', workspaceId: 'ws1', name: 'Backlog', category: 'todo', order: 2, isDefault: false },
  { id: 's2', projectId: null, workspaceId: 'ws1', name: 'Default Todo', category: 'todo', order: 0, isDefault: true },
  { id: 's3', projectId: 'p1', workspaceId: 'ws1', name: 'In Review', category: 'in_progress', order: 1, isDefault: false },
  { id: 's4', projectId: 'p2', workspaceId: 'ws1', name: 'Other proj', category: 'todo', order: 0, isDefault: false },
];

describe('WorkflowStatusStore', () => {
  let store: WorkflowStatusStore;
  const apiMock = {
    listByProject: vi.fn().mockResolvedValue(statuses.filter(s => s.projectId !== 'p2')),
  };

  beforeEach(() => {
    apiMock.listByProject.mockClear();
    apiMock.listByProject.mockResolvedValue(statuses.filter(s => s.projectId !== 'p2'));
    TestBed.configureTestingModule({
      providers: [
        WorkflowStatusStore,
        { provide: WorkflowStatusApiService, useValue: apiMock },
      ],
    });
    store = TestBed.inject(WorkflowStatusStore);
    store.load(statuses);
  });

  it('byProject includes project-scoped and workspace defaults sorted by order', () => {
    const list = store.byProject('p1')();
    expect(list.map(s => s.id)).toEqual(['s2', 's3', 's1']);
  });

  it('byProject excludes other projects', () => {
    const list = store.byProject('p1')();
    expect(list.find(s => s.id === 's4')).toBeUndefined();
  });

  it('byId returns status by id', () => {
    expect(store.byId()['s1']?.name).toBe('Backlog');
  });

  it('loadForProject fetches and stores statuses', async () => {
    store.clear();
    await store.loadForProject('p1');
    expect(apiMock.listByProject).toHaveBeenCalledWith('p1');
    expect(store.byProject('p1')().length).toBe(3);
  });
});
