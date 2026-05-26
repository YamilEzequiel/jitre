import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { KanbanBoardComponent, rankBetween } from './kanban-board.component';
import { TaskStore } from '../../../stores/task.store';
import { TaskApiService, Task } from '../../../stores/task-api.service';
import { WorkflowStatusStore } from '../../../stores/workflow-status.store';
import { LabelStore } from '../../../stores/label.store';
import { ProjectMemberStore } from '../../../stores/project-member.store';
import { OptimisticUpdateService } from '../../../core/optimistic/optimistic-update.service';
import { ToastService } from '../../../core/toast/toast.service';

const statuses = [
  { id: 's-todo', projectId: 'p1', workspaceId: 'ws1', name: 'Todo', category: 'todo', order: 1, isDefault: true },
  { id: 's-doing', projectId: 'p1', workspaceId: 'ws1', name: 'Doing', category: 'in_progress', order: 2, isDefault: false },
  { id: 's-done', projectId: 'p1', workspaceId: 'ws1', name: 'Done', category: 'done', order: 3, isDefault: false },
];

const mockTasks: Task[] = [
  { id: 't1', projectId: 'p1', workspaceId: 'ws1', statusId: 's-todo', title: 'A', priority: 'none', type: 'task', rank: 'a' },
  { id: 't2', projectId: 'p1', workspaceId: 'ws1', statusId: 's-todo', title: 'B', priority: 'none', type: 'task', rank: 'b' },
  { id: 't3', projectId: 'p1', workspaceId: 'ws1', statusId: 's-doing', title: 'C', priority: 'none', type: 'task', rank: 'a' },
];

describe('KanbanBoardComponent', () => {
  let fixture: ComponentFixture<KanbanBoardComponent>;
  let taskApi: { changeStatus: ReturnType<typeof vi.fn>; reorder: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; addAssignee: ReturnType<typeof vi.fn>; removeAssignee: ReturnType<typeof vi.fn> };
  let optimistic: { run: ReturnType<typeof vi.fn>; isPending: ReturnType<typeof vi.fn> };
  let taskStore: { byProject: ReturnType<typeof vi.fn>; byId: ReturnType<typeof signal>; upsert: ReturnType<typeof vi.fn>; loadForProject: ReturnType<typeof vi.fn> };
  let statusStore: { byProject: ReturnType<typeof vi.fn>; byId: ReturnType<typeof signal>; loadForProject: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const taskSig = signal(mockTasks);
    const statusSig = signal(statuses);
    const byIdSig = computed(() => {
      const out: Record<string, Task> = {};
      for (const t of taskSig()) out[t.id] = t;
      return out;
    });

    taskApi = {
      changeStatus: vi.fn().mockResolvedValue(mockTasks[0]),
      reorder: vi.fn().mockResolvedValue(mockTasks[0]),
      update: vi.fn().mockResolvedValue(mockTasks[0]),
      addAssignee: vi.fn().mockResolvedValue(undefined),
      removeAssignee: vi.fn().mockResolvedValue(undefined),
    };
    optimistic = {
      run: vi.fn(async (opts: { apply: () => () => void; apiCall: () => Promise<unknown> }) => {
        const rollback = opts.apply();
        try {
          await opts.apiCall();
        } catch {
          rollback();
        }
      }),
      isPending: vi.fn().mockReturnValue(false),
    };
    taskStore = {
      byProject: vi.fn(() => taskSig),
      byId: byIdSig as unknown as ReturnType<typeof signal>,
      upsert: vi.fn(),
      loadForProject: vi.fn().mockResolvedValue(undefined),
    };
    statusStore = {
      byProject: vi.fn(() => statusSig),
      byId: signal({}) as unknown as ReturnType<typeof signal>,
      loadForProject: vi.fn().mockResolvedValue(undefined),
    };
    router = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: TaskStore, useValue: taskStore },
        { provide: TaskApiService, useValue: taskApi },
        { provide: WorkflowStatusStore, useValue: statusStore },
        {
          provide: LabelStore,
          useValue: {
            byId: signal({}),
            byProject: vi.fn(() => signal([])),
            loadForProject: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ProjectMemberStore,
          useValue: {
            byProject: vi.fn(() => signal([])),
            loadForProject: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: OptimisticUpdateService, useValue: optimistic },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(KanbanBoardComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders one column per status from store', () => {
    expect(fixture.componentInstance.statuses().length).toBe(3);
  });

  it('filters tasks correctly by statusId', () => {
    const todo = fixture.componentInstance.tasksFor('s-todo');
    const doing = fixture.componentInstance.tasksFor('s-doing');
    expect(todo.length).toBe(2);
    expect(doing.length).toBe(1);
    expect(doing[0].id).toBe('t3');
  });

  it('orders tasks by rank within a column', () => {
    const todo = fixture.componentInstance.tasksFor('s-todo');
    expect(todo.map(t => t.id)).toEqual(['t1', 't2']);
  });

  it('dispatches changeStatus + reorder when drop in a different column', async () => {
    const dataTransfer = {
      getData: vi.fn().mockReturnValue('t1'),
      setData: vi.fn(),
      effectAllowed: '',
      dropEffect: '',
    };
    const event = { preventDefault: vi.fn(), dataTransfer } as unknown as DragEvent;
    await fixture.componentInstance.onDrop(event, 's-doing', undefined, 't3');
    expect(taskApi.changeStatus).toHaveBeenCalledWith('p1', 't1', 's-doing');
    expect(taskApi.reorder).toHaveBeenCalled();
  });

  it('dispatches reorder only when drop in same column', async () => {
    const dataTransfer = {
      getData: vi.fn().mockReturnValue('t1'),
      setData: vi.fn(),
      effectAllowed: '',
      dropEffect: '',
    };
    const event = { preventDefault: vi.fn(), dataTransfer } as unknown as DragEvent;
    await fixture.componentInstance.onDrop(event, 's-todo', 't2', undefined);
    expect(taskApi.changeStatus).not.toHaveBeenCalled();
    expect(taskApi.reorder).toHaveBeenCalledWith('p1', 't1', { beforeId: 't2', afterId: undefined });
  });

  it('rolls back optimistic update on API error', async () => {
    taskApi.reorder.mockRejectedValueOnce(new Error('boom'));
    const dataTransfer = {
      getData: vi.fn().mockReturnValue('t1'),
      setData: vi.fn(),
      effectAllowed: '',
      dropEffect: '',
    };
    const event = { preventDefault: vi.fn(), dataTransfer } as unknown as DragEvent;
    await fixture.componentInstance.onDrop(event, 's-todo', 't2', undefined);
    // Two upserts: one optimistic, one rollback to original.
    expect(taskStore.upsert).toHaveBeenCalledTimes(2);
  });

  it('routes changedStatus event to API', () => {
    fixture.componentInstance.handleChangedStatus({
      task: mockTasks[0],
      newStatusId: 's-done',
    });
    expect(optimistic.run).toHaveBeenCalled();
  });

  it('routes changedPriority event to API update', () => {
    fixture.componentInstance.handleChangedPriority({
      task: mockTasks[0],
      newPriority: 'urgent',
    });
    expect(optimistic.run).toHaveBeenCalled();
  });

  it('routes changedAssignee add to addAssignee API', () => {
    fixture.componentInstance.handleChangedAssignee({
      task: mockTasks[0],
      userId: 'user-x',
      action: 'add',
    });
    expect(optimistic.run).toHaveBeenCalled();
  });

  it('opens a task with its project context', () => {
    fixture.componentInstance.openTask(mockTasks[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/tasks', 't1'], {
      queryParams: { projectId: 'p1' },
    });
  });
});

describe('rankBetween helper', () => {
  it('returns midpoint between two ranks', () => {
    const m = rankBetween('a', 'c');
    expect(m > 'a' && m < 'c').toBe(true);
  });

  it('appends marker when only before is provided', () => {
    expect(rankBetween('a', null)).toBe('am');
  });

  it('returns a string lexically before `after` when only after is provided', () => {
    const r = rankBetween(null, 'm');
    expect(r < 'm').toBe(true);
  });

  it('returns a default value when both are null', () => {
    expect(typeof rankBetween(null, null)).toBe('string');
  });
});
