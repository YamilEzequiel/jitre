import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskDetailComponent } from './task-detail.component';
import { TaskStore } from '../../../stores/task.store';
import { TaskApiService, Task } from '../../../stores/task-api.service';
import { WorkflowStatusStore } from '../../../stores/workflow-status.store';
import { OptimisticUpdateService } from '../../../core/optimistic/optimistic-update.service';
import { AiService } from '../../../core/ai/ai.service';
import { ToastService } from '../../../core/toast/toast.service';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { signal, computed } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

const mockTask: Task = {
  id: 't1',
  title: 'Fix the bug',
  statusId: 'status-1',
  projectId: 'p1',
  workspaceId: 'ws1',
  priority: 'medium',
  type: 'task',
  rank: 'n',
};

describe('TaskDetailComponent', () => {
  let fixture: ComponentFixture<TaskDetailComponent>;
  let apiMock: {
    getById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    changeStatus: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let optimisticMock: { run: ReturnType<typeof vi.fn>; isPending: ReturnType<typeof vi.fn> };
  let aiMock: {
    loading: { describe: ReturnType<typeof signal>; suggestSubtasks: ReturnType<typeof signal> };
    describeTask: ReturnType<typeof vi.fn>;
  };
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const byIdSignal = computed(() => ({ t1: mockTask }) as Record<string, Task>);

  beforeEach(() => {
    apiMock = {
      getById: vi.fn().mockResolvedValue(mockTask),
      update: vi.fn().mockResolvedValue(mockTask),
      changeStatus: vi.fn().mockResolvedValue(mockTask),
      create: vi.fn().mockResolvedValue({ ...mockTask, id: 's1', parentTaskId: 't1', title: 'New sub' }),
    };
    optimisticMock = {
      run: vi.fn().mockResolvedValue(mockTask),
      isPending: vi.fn().mockReturnValue(false),
    };
    aiMock = {
      loading: { describe: signal(false), suggestSubtasks: signal(false) },
      describeTask: vi.fn().mockResolvedValue({ description: 'AI generated' }),
    };
    toastMock = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        provideRouter([]),
        {
          provide: TaskStore,
          useValue: { byId: byIdSignal, upsert: vi.fn() },
        },
        { provide: TaskApiService, useValue: apiMock },
        {
          provide: WorkflowStatusStore,
          useValue: {
            byId: signal({}),
            byProject: vi.fn(() => signal([
              { id: 'status-1', name: 'Todo', category: 'todo', isDefault: true },
              { id: 'status-done', name: 'Done', category: 'done', isDefault: false },
            ])),
          },
        },
        { provide: OptimisticUpdateService, useValue: optimisticMock },
        { provide: AiService, useValue: aiMock },
        { provide: ToastService, useValue: toastMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 't1' },
              queryParamMap: { get: () => null },
            },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(TaskDetailComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('resolves task from store by id', () => {
    expect(fixture.componentInstance.task()).toBeTruthy();
    expect(fixture.componentInstance.task()?.title).toBe('Fix the bug');
    expect(apiMock.getById).not.toHaveBeenCalled();
  });

  it('renders task title', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Fix the bug');
  });

  it('saveTitle calls optimistic run', async () => {
    const comp = fixture.componentInstance;
    comp.titleControl.setValue('New title');
    await comp.saveTitle();
    expect(optimisticMock.run).toHaveBeenCalled();
  });

  it('fetchComments loads comments via http', async () => {
    const comp = fixture.componentInstance;
    await comp.loadComments();
    expect(comp.commentsLoading()).toBe(false);
  });

  it('changeStatus updates task optimistically', async () => {
    const comp = fixture.componentInstance;
    await comp.changeStatus('new-status-id');
    expect(optimisticMock.run).toHaveBeenCalled();
  });

  it('editing signal toggles on enterEdit/cancelEdit', () => {
    const comp = fixture.componentInstance;
    comp.enterEdit();
    expect(comp.editing()).toBe(true);
    comp.cancelEdit();
    expect(comp.editing()).toBe(false);
  });

  it('aiDescribeLoading reflects AiService signal', () => {
    const comp = fixture.componentInstance;
    expect(comp.aiDescribeLoading()).toBe(false);
  });

  it('comment text reset after submit attempt', () => {
    const comp = fixture.componentInstance;
    comp.commentControl.setValue('My comment');
    comp.commentControl.reset();
    expect(comp.commentControl.value).toBeNull();
  });

  it('allows creating subtasks for a root task', () => {
    const comp = fixture.componentInstance;
    expect(comp.canCreateSubtasks()).toBe(true);
  });

  it('addSubtask calls the API and stores the result', async () => {
    const comp = fixture.componentInstance;
    comp.subtaskTitleControl.setValue('Implement X');
    await comp.addSubtask();
    expect(apiMock.create).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ title: 'Implement X', parentTaskId: 't1' }),
    );
  });

  it('does not add subtask when title is empty', async () => {
    const comp = fixture.componentInstance;
    comp.subtaskTitleControl.setValue('   ');
    await comp.addSubtask();
    expect(apiMock.create).not.toHaveBeenCalled();
  });

  it('changeType triggers optimistic update with the new type', async () => {
    const comp = fixture.componentInstance;
    await comp.changeType('bug');
    expect(optimisticMock.run).toHaveBeenCalled();
  });

  it('changeType is a no-op when type is unchanged', async () => {
    const comp = fixture.componentInstance;
    optimisticMock.run.mockClear();
    await comp.changeType('task');
    expect(optimisticMock.run).not.toHaveBeenCalled();
  });

  it('exposes the four type options', () => {
    expect(fixture.componentInstance.typeOptions).toEqual(['task', 'bug', 'incident', 'feature']);
  });

  it('fetches the task by id when it is missing from the store', async () => {
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        provideRouter([]),
        {
          provide: TaskStore,
          useValue: { byId: signal({}), upsert: vi.fn() },
        },
        { provide: TaskApiService, useValue: apiMock },
        {
          provide: WorkflowStatusStore,
          useValue: {
            byId: signal({}),
            byProject: vi.fn(() => signal([])),
          },
        },
        { provide: OptimisticUpdateService, useValue: optimisticMock },
        { provide: AiService, useValue: aiMock },
        { provide: ToastService, useValue: toastMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 't1' },
              queryParamMap: { get: (key: string) => (key === 'projectId' ? 'p1' : null) },
            },
          },
        },
      ],
    });

    const missingFixture = TestBed.createComponent(TaskDetailComponent);
    missingFixture.detectChanges();
    await Promise.resolve();

    expect(apiMock.getById).toHaveBeenCalledWith('t1', 'p1');
  });
});
