import { TestBed } from '@angular/core/testing';
import { TaskStore } from './task.store';
import { TaskApiService, Task } from './task-api.service';

const tasks: Task[] = [
  {
    id: 't1',
    title: 'T1',
    statusId: 's-todo',
    projectId: 'p1',
    workspaceId: 'ws1',
    priority: 'none',
    type: 'task',
    rank: 'n',
    assigneeUserIds: ['u1'],
  },
  {
    id: 't2',
    title: 'T2',
    statusId: 's-progress',
    projectId: 'p2',
    workspaceId: 'ws1',
    priority: 'high',
    type: 'task',
    rank: 'o',
    assigneeUserIds: ['u2'],
  },
  {
    id: 't3',
    title: 'T3',
    statusId: 's-done',
    projectId: 'p1',
    workspaceId: 'ws1',
    priority: 'low',
    type: 'task',
    rank: 'p',
    assigneeUserIds: ['u1'],
  },
];

describe('TaskStore', () => {
  let store: TaskStore;
  const mockTaskApi = {
    getById: vi.fn(),
    list: vi.fn().mockResolvedValue(tasks),
  };

  beforeEach(() => {
    mockTaskApi.getById.mockReset();
    mockTaskApi.list.mockReset();
    mockTaskApi.list.mockResolvedValue(tasks);
    TestBed.configureTestingModule({
      providers: [
        TaskStore,
        { provide: TaskApiService, useValue: mockTaskApi },
      ],
    });
    store = TestBed.inject(TaskStore);
    store.load(tasks);
  });

  it('byProject returns tasks filtered by projectId', () => {
    const p1Tasks = store.byProject('p1')();
    expect(p1Tasks).toHaveLength(2);
    expect(p1Tasks.every(t => t.projectId === 'p1')).toBe(true);
  });

  it('byAssignee returns tasks where assigneeUserIds contains the userId', () => {
    const u1Tasks = store.byAssignee('u1')();
    expect(u1Tasks).toHaveLength(2);
    expect(u1Tasks.every(t => (t.assigneeUserIds ?? []).includes('u1'))).toBe(true);
  });

  it('byStatusId returns tasks filtered by statusId', () => {
    const todoTasks = store.byStatusId('s-todo')();
    expect(todoTasks).toHaveLength(1);
    expect(todoTasks[0].id).toBe('t1');
  });

  it('workspace switch clears tasks', async () => {
    expect(store.items()).toHaveLength(3);
    await store.onWorkspaceSwitch('ws2');
    expect(store.items()).toHaveLength(0);
  });

  it('loadForProject fetches via api and replaces the project slice', async () => {
    mockTaskApi.list.mockResolvedValueOnce([{ ...tasks[0], title: 'Reloaded T1' }]);
    await store.loadForProject('p1');
    expect(mockTaskApi.list).toHaveBeenCalledWith('p1');
    const p1 = store.byProject('p1')();
    expect(p1).toHaveLength(1);
    expect(p1[0].title).toBe('Reloaded T1');
    // p2 should still be in the store
    expect(store.byProject('p2')()).toHaveLength(1);
  });

  it('setRefetcher wires getById so applyEvent can upsert', async () => {
    const freshTask: Task = { ...tasks[0], title: 'Updated T1' };
    mockTaskApi.getById.mockResolvedValue(freshTask);
    await store.applyEvent({ type: 'updated', id: 't1' });
    expect(mockTaskApi.getById).toHaveBeenCalledWith('p1', 't1');
    expect(store.byId()['t1']?.title).toBe('Updated T1');
  });
});
