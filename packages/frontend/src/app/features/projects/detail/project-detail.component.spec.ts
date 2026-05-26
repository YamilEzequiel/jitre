import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectStore } from '../../../stores/project.store';
import { TaskStore } from '../../../stores/task.store';
import { WorkflowStatusStore } from '../../../stores/workflow-status.store';
import { LabelStore } from '../../../stores/label.store';
import { ProjectMemberStore } from '../../../stores/project-member.store';
import { WorkflowStatus, WorkflowStatusApiService } from '../../../stores/workflow-status-api.service';
import { PlanningApiService } from '../../../stores/planning-api.service';
import { TaskApiService } from '../../../stores/task-api.service';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { OptimisticUpdateService } from '../../../core/optimistic/optimistic-update.service';
import { ToastService } from '../../../core/toast/toast.service';
import { ActivatedRoute } from '@angular/router';
import { signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ChatApiService } from '../../../stores/chat-api.service';

const mockProject = { id: 'p1', name: 'Alpha', key: 'ALPHA', status: 'active', workspaceId: 'ws1' };
const mockTasks = [
  {
    id: 't1',
    title: 'Task 1',
    statusId: 'status-uuid-1',
    projectId: 'p1',
    workspaceId: 'ws1',
    priority: 'none',
    type: 'task',
    rank: 'n',
  },
];

describe('ProjectDetailComponent', () => {
  let fixture: ComponentFixture<ProjectDetailComponent>;
  const tasksSignal = signal(mockTasks);
  const workflowStatusesSignal = signal<WorkflowStatus[]>([
    { id: 'status-uuid-1', projectId: 'p1', workspaceId: 'ws1', name: 'To do', category: 'todo', order: 0, isDefault: true },
    { id: 'status-uuid-2', projectId: 'p1', workspaceId: 'ws1', name: 'Done', category: 'done', order: 1, isDefault: false },
  ]);
  const byIdSignal = computed(() => ({ p1: mockProject }) as Record<string, typeof mockProject>);
  const createStatus = vi.fn();
  const updateStatus = vi.fn();
  const deleteStatus = vi.fn();
  const createPlanningItem = vi.fn();
  const updateTask = vi.fn();
  const toast = { success: vi.fn(), error: vi.fn() };
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  const chatApi = { getProjectChannel: vi.fn().mockResolvedValue({ id: 'chat-p1' }) };

  beforeEach(() => {
    createStatus.mockReset().mockResolvedValue({
      id: 'status-uuid-3',
      projectId: 'p1',
      workspaceId: 'ws1',
      name: 'QA Review',
      category: 'in_progress',
      order: 2,
      isDefault: false,
    });
    updateStatus.mockReset().mockImplementation((id: string, body: object) =>
      Promise.resolve({ ...workflowStatusesSignal().find(status => status.id === id), ...body }),
    );
    deleteStatus.mockReset().mockResolvedValue(undefined);
    createPlanningItem.mockReset().mockResolvedValue({
      id: 'epic-1',
      projectId: 'p1',
      workspaceId: 'ws1',
      type: 'epic',
      name: 'Platform',
      status: 'planned',
    });
    updateTask.mockReset().mockResolvedValue({ ...mockTasks[0], sprintId: 'sprint-1' });
    toast.success.mockReset();
    toast.error.mockReset();
    router.navigate.mockClear();
    chatApi.getProjectChannel.mockClear();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ProjectStore,
          useValue: { byId: byIdSignal, loadById: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: TaskStore,
          useValue: {
            items: tasksSignal.asReadonly(),
            loading: signal(false).asReadonly(),
            byProject: vi.fn(() => signal(mockTasks)),
            byId: signal({ t1: mockTasks[0] }),
            upsert: vi.fn(),
            loadForProject: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: WorkflowStatusStore,
          useValue: {
            byId: computed(() => ({
              'status-uuid-1': workflowStatusesSignal()[0],
              'status-uuid-2': workflowStatusesSignal()[1],
            })),
            byProject: vi.fn(() => workflowStatusesSignal),
            loadForProject: vi.fn().mockResolvedValue(undefined),
            upsert: vi.fn(),
            remove: vi.fn(),
          },
        },
        {
          provide: WorkflowStatusApiService,
          useValue: { create: createStatus, update: updateStatus, delete: deleteStatus },
        },
        {
          provide: AnalyticsService,
          useValue: {
            lastNDays: vi.fn().mockReturnValue({ from: 'from', to: 'to' }),
            getProjectVelocity: vi.fn().mockResolvedValue([{ period: 'day', value: 3 }]),
            getProjectBurndown: vi.fn().mockResolvedValue([{}]),
            getProjectLeadTime: vi.fn().mockResolvedValue([{}]),
            getProjectCycleTime: vi.fn().mockResolvedValue([{}]),
            getProjectStatusFlow: vi.fn().mockResolvedValue([{}]),
          },
        },
        {
          provide: PlanningApiService,
          useValue: {
            list: vi.fn().mockResolvedValue([]),
            create: createPlanningItem,
          },
        },
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
        {
          provide: TaskApiService,
          useValue: {
            changeStatus: vi.fn(),
            reorder: vi.fn(),
            update: updateTask,
            addAssignee: vi.fn(),
            removeAssignee: vi.fn(),
          },
        },
        {
          provide: OptimisticUpdateService,
          useValue: { run: vi.fn(), isPending: vi.fn().mockReturnValue(false) },
        },
        { provide: ToastService, useValue: toast },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'p1' } } },
        },
        { provide: Router, useValue: router },
        { provide: ChatApiService, useValue: chatApi },
      ],
    });

    fixture = TestBed.createComponent(ProjectDetailComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders project name', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Alpha');
  });

  it('defaults to tasks tab', () => {
    expect(fixture.componentInstance.activeTab()).toBe('tasks');
  });

  it('switches tabs via signal', () => {
    const comp = fixture.componentInstance;
    comp.activeTab.set('members');
    fixture.detectChanges();
    expect(comp.activeTab()).toBe('members');
  });

  it('renders planning and workflow tabs', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Backlog');
    expect(el.textContent).toContain('Roadmap');
    fixture.componentInstance.activeTab.set('settings');
    fixture.detectChanges();
    expect(el.textContent).toContain('Estados del proyecto');
  });

  it('creates a workflow status from settings', async () => {
    const comp = fixture.componentInstance;
    comp.newStatusName = 'QA Review';
    await comp.createStatus();
    expect(createStatus).toHaveBeenCalledWith('p1', {
      name: 'QA Review',
      category: 'in_progress',
      order: 2,
    });
    expect(comp.newStatusName).toBe('');
  });

  it('updates and reorders workflow statuses', async () => {
    const comp = fixture.componentInstance;
    const todo = workflowStatusesSignal()[0];
    comp.editStatus(todo);
    comp.editStatusName = 'Ready';
    await comp.saveStatus(todo);
    expect(updateStatus).toHaveBeenCalledWith('status-uuid-1', {
      name: 'Ready',
      category: 'todo',
    });
    await comp.moveStatus(todo, 1);
    expect(updateStatus).toHaveBeenCalledWith('status-uuid-1', { order: 1 });
    expect(updateStatus).toHaveBeenCalledWith('status-uuid-2', { order: 0 });
  });

  it('deletes a workflow status with a replacement', async () => {
    const comp = fixture.componentInstance;
    comp.deleteReplacementByStatus['status-uuid-1'] = 'status-uuid-2';
    await comp.deleteStatus(workflowStatusesSignal()[0]);
    expect(deleteStatus).toHaveBeenCalledWith('status-uuid-1', 'status-uuid-2');
  });

  it('creates an epic and assigns a task to a sprint', async () => {
    const comp = fixture.componentInstance;
    comp.newEpicName = 'Platform';
    await comp.createPlanningItem('epic');
    expect(createPlanningItem).toHaveBeenCalledWith('p1', { type: 'epic', name: 'Platform' });
    await comp.assignPlanning(mockTasks[0] as never, 'sprintId', 'sprint-1');
    expect(updateTask).toHaveBeenCalledWith('p1', 't1', { sprintId: 'sprint-1' });
  });

  it('persists sprint planning dates', async () => {
    const comp = fixture.componentInstance;
    comp.newSprintName = 'Sprint 1';
    comp.newSprintStartDate = '2026-05-25';
    comp.newSprintEndDate = '2026-06-08';
    await comp.createPlanningItem('sprint');
    expect(createPlanningItem).toHaveBeenCalledWith('p1', {
      type: 'sprint',
      name: 'Sprint 1',
      startDate: '2026-05-25',
      endDate: '2026-06-08',
    });
  });

  it('creates a release with its target date', async () => {
    const comp = fixture.componentInstance;
    comp.newReleaseName = 'v1.0';
    comp.newReleaseDate = '2026-06-30';
    await comp.createPlanningItem('release');
    expect(createPlanningItem).toHaveBeenCalledWith('p1', {
      type: 'release',
      name: 'v1.0',
      endDate: '2026-06-30',
    });
  });

  it('shows a useful error when creating a planning item fails', async () => {
    createPlanningItem.mockRejectedValueOnce(new Error('request failed'));
    const comp = fixture.componentInstance;
    comp.newEpicName = 'Broken';
    await comp.createPlanningItem('epic');
    expect(comp.planningError()).toContain('No se pudo crear');
    expect(toast.error).toHaveBeenCalled();
  });

  it('shows an explicit validation error when release name is empty', async () => {
    const comp = fixture.componentInstance;
    comp.newReleaseName = '   ';
    await comp.createPlanningItem('release');
    expect(createPlanningItem).not.toHaveBeenCalled();
    expect(comp.planningError()).toContain('Completá el nombre');
    expect(toast.error).toHaveBeenCalled();
  });

  it('defaults task view to board', () => {
    expect(fixture.componentInstance.taskView()).toBe('board');
  });

  it('opens a task with its project context', () => {
    fixture.componentInstance.openTask(mockTasks[0] as never);
    expect(router.navigate).toHaveBeenCalledWith(['/tasks', 't1'], {
      queryParams: { projectId: 'p1' },
    });
  });

  it('switches task view to list and persists to localStorage', () => {
    const comp = fixture.componentInstance;
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    comp.setTaskView('list');
    expect(comp.taskView()).toBe('list');
    expect(setItem).toHaveBeenCalledWith('jitre.project.p1.taskView', 'list');
    setItem.mockRestore();
  });

  it('applies filters to projectTasks', () => {
    const comp = fixture.componentInstance;
    expect(comp.filteredTasks().length).toBe(1);
    comp.filters.set({ q: 'nope' });
    expect(comp.filteredTasks().length).toBe(0);
  });

  it('opens the linked project chat', async () => {
    const comp = fixture.componentInstance;
    await comp.openProjectChat();
    expect(chatApi.getProjectChannel).toHaveBeenCalledWith('p1');
    expect(router.navigate).toHaveBeenCalledWith(['/chat', 'chat-p1']);
  });
});
