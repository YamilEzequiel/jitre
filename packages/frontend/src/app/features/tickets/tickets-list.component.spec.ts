import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { TicketsListComponent } from './tickets-list.component';
import { TaskStore } from '../../stores/task.store';
import { ProjectStore } from '../../stores/project.store';
import { TaskApiService, Task } from '../../stores/task-api.service';
import { WorkflowStatusStore } from '../../stores/workflow-status.store';
import { ProjectMemberStore } from '../../stores/project-member.store';

const tasks: Task[] = [
  {
    id: 'b1',
    title: 'Login crashes on Safari',
    projectId: 'p1',
    workspaceId: 'ws1',
    statusId: 'status-1',
    priority: 'high',
    type: 'bug',
    rank: 'a',
  },
  {
    id: 'i1',
    title: 'Production DB outage',
    projectId: 'p2',
    workspaceId: 'ws1',
    statusId: 'status-2',
    priority: 'urgent',
    type: 'incident',
    rank: 'b',
    assigneeUserIds: ['user-alpha'],
  },
  {
    id: 't1',
    title: 'Refactor auth flow',
    projectId: 'p1',
    workspaceId: 'ws1',
    statusId: 'status-1',
    priority: 'medium',
    type: 'task',
    rank: 'c',
  },
  {
    id: 'f1',
    title: 'Dark mode toggle',
    projectId: 'p1',
    workspaceId: 'ws1',
    statusId: 'status-1',
    priority: 'low',
    type: 'feature',
    rank: 'd',
  },
];

describe('TicketsListComponent', () => {
  let fixture: ComponentFixture<TicketsListComponent>;
  let taskStoreMock: {
    items: ReturnType<typeof signal<Task[]>>;
    byId: ReturnType<typeof signal>;
    upsert: ReturnType<typeof vi.fn>;
  };
  let projectStoreMock: {
    items: ReturnType<typeof signal>;
    byId: ReturnType<typeof signal>;
  };
  let apiMock: { list: ReturnType<typeof vi.fn> };
  let navigateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    taskStoreMock = {
      items: signal<Task[]>(tasks),
      byId: signal(Object.fromEntries(tasks.map(t => [t.id, t]))),
      upsert: vi.fn(),
    };
    projectStoreMock = {
      items: signal([
        { id: 'p1', name: 'Apollo', key: 'APOLLO', status: 'active', workspaceId: 'ws1' },
        { id: 'p2', name: 'Mercury', key: 'MERCURY', status: 'active', workspaceId: 'ws1' },
      ]),
      byId: signal({
        p1: { id: 'p1', name: 'Apollo' },
        p2: { id: 'p2', name: 'Mercury' },
      }),
    };
    apiMock = { list: vi.fn().mockResolvedValue([]) };
    navigateSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TaskStore, useValue: taskStoreMock },
        { provide: ProjectStore, useValue: projectStoreMock },
        { provide: TaskApiService, useValue: apiMock },
        {
          provide: WorkflowStatusStore,
          useValue: {
            byId: signal({
              'status-1': { name: 'Todo' },
              'status-2': { name: 'In Review' },
            }),
          },
        },
        { provide: ProjectMemberStore, useValue: { byProject: () => signal([]) } },
        { provide: Router, useValue: { navigate: navigateSpy } },
      ],
    });

    fixture = TestBed.createComponent(TicketsListComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows only bugs and incidents by default (excludes task/feature)', () => {
    const list = fixture.componentInstance.filteredTickets();
    expect(list.length).toBe(2);
    const types = list.map(t => t.type).sort();
    expect(types).toEqual(['bug', 'incident']);
  });

  it('filters by type=bug only', () => {
    const comp = fixture.componentInstance;
    comp.typeControl.setValue('bug');
    const list = comp.filteredTickets();
    expect(list.length).toBe(1);
    expect(list[0].type).toBe('bug');
  });

  it('filters by type=incident only', () => {
    const comp = fixture.componentInstance;
    comp.typeControl.setValue('incident');
    const list = comp.filteredTickets();
    expect(list.length).toBe(1);
    expect(list[0].type).toBe('incident');
  });

  it('filters by project', () => {
    const comp = fixture.componentInstance;
    comp.projectControl.setValue('p2');
    const list = comp.filteredTickets();
    expect(list.every(t => t.projectId === 'p2')).toBe(true);
  });

  it('filters by priority', () => {
    const comp = fixture.componentInstance;
    comp.priorityControl.setValue('urgent');
    const list = comp.filteredTickets();
    expect(list.every(t => t.priority === 'urgent')).toBe(true);
  });

  it('search filters by title after debounce', () => {
    const comp = fixture.componentInstance;
    comp.searchControl.setValue('outage');
    vi.advanceTimersByTime(300);
    const list = comp.filteredTickets();
    expect(list.length).toBe(1);
    expect(list[0].title.toLowerCase()).toContain('outage');
  });

  it('renders ticket rows with type icons', () => {
    const el = fixture.nativeElement as HTMLElement;
    const rows = el.querySelectorAll('[data-testid="ticket-row"]');
    expect(rows.length).toBe(2);
  });

  it('resolves project name via store', () => {
    expect(fixture.componentInstance.projectName('p1')).toBe('Apollo');
  });

  it('resolves status name via store', () => {
    expect(fixture.componentInstance.statusName('status-1')).toBe('Todo');
  });

  it('openTicket navigates to the task route', () => {
    fixture.componentInstance.openTicket(tasks[0]);
    expect(navigateSpy).toHaveBeenCalledWith(['/tasks', 'b1'], {
      queryParams: { projectId: 'p1' },
    });
  });

  it('renders empty state when filters exclude everything', () => {
    const comp = fixture.componentInstance;
    comp.searchControl.setValue('zzz-no-match-zzz');
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="tickets-empty"]')).toBeTruthy();
  });
});
