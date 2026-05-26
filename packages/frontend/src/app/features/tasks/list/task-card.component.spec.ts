import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal, computed } from '@angular/core';
import { TaskCardComponent } from './task-card.component';
import type { Task } from '../../../stores/task-api.service';
import { WorkflowStatusStore } from '../../../stores/workflow-status.store';
import { LabelStore } from '../../../stores/label.store';
import { ProjectMemberStore } from '../../../stores/project-member.store';

const baseTask: Task = {
  id: 't1',
  title: 'Fix the bug',
  statusId: 'status-uuid-1',
  projectId: 'p1',
  workspaceId: 'ws1',
  priority: 'medium',
  type: 'task',
  rank: 'n',
};

function setupTestBed(opts: { task?: Task; variant?: 'row' | 'tile' } = {}) {
  const statusById = signal({
    'status-uuid-1': { name: 'In Progress', color: '#6366f1', category: 'in_progress' },
  });
  const labelsById = signal({
    'l1': { name: 'Bug', color: '#ff0000' },
    'l2': { name: 'Frontend', color: '#00ff00' },
  });
  const members = signal([
    { id: 'm1', userId: 'user-alpha', projectId: 'p1', displayName: 'Alice Alpha', role: 'admin' },
    { id: 'm2', userId: 'user-bravo', projectId: 'p1', displayName: 'Bob Bravo', role: 'contributor' },
  ]);

  TestBed.configureTestingModule({
    providers: [
      {
        provide: WorkflowStatusStore,
        useValue: {
          byId: statusById,
          byProject: vi.fn(() => computed(() => [{ id: 'status-uuid-1', name: 'In Progress' }])),
        },
      },
      {
        provide: LabelStore,
        useValue: { byId: labelsById },
      },
      {
        provide: ProjectMemberStore,
        useValue: {
          byProject: vi.fn(() => members),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(TaskCardComponent);
  fixture.componentRef.setInput('task', opts.task ?? baseTask);
  if (opts.variant) fixture.componentRef.setInput('variant', opts.variant);
  fixture.detectChanges();
  return fixture;
}

describe('TaskCardComponent', () => {
  let fixture: ComponentFixture<TaskCardComponent>;

  afterEach(() => TestBed.resetTestingModule());

  describe('row variant (default)', () => {
    beforeEach(() => {
      fixture = setupTestBed();
    });

    it('creates component', () => {
      expect(fixture.componentInstance).toBeTruthy();
    });

    it('renders task title', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Fix the bug');
    });

    it('renders priority pill when not none', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent?.toLowerCase()).toContain('medium');
    });

    it('renders status name from store', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('In Progress');
    });
  });

  describe('tile variant', () => {
    beforeEach(() => {
      fixture = setupTestBed({ variant: 'tile' });
    });

    it('renders draggable card', () => {
      const el = fixture.nativeElement as HTMLElement;
      const card = el.querySelector('[role="listitem"]');
      expect(card).toBeTruthy();
      expect(card?.getAttribute('aria-label')).toContain('draggable');
    });

    it('shows priority chip', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent?.toLowerCase()).toContain('medium');
    });
  });

  describe('priority/due date display', () => {
    it('omits priority pill when priority is none', () => {
      fixture = setupTestBed({ task: { ...baseTask, priority: 'none' } });
      const el = fixture.nativeElement as HTMLElement;
      // No 'medium' / priority text rendered when priority is 'none'
      const text = el.textContent ?? '';
      expect(/\b(low|medium|high|urgent)\b/i.test(text)).toBe(false);
    });

    it('renders due date pill when dueDate present', () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      fixture = setupTestBed({ task: { ...baseTask, dueDate: future } });
      const el = fixture.nativeElement as HTMLElement;
      // Has a month abbreviation visible
      expect(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/.test(el.textContent ?? '')).toBe(true);
    });

    it('marks dueDate as overdue when past and not done', () => {
      const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      fixture = setupTestBed({ task: { ...baseTask, dueDate: past } });
      expect(fixture.componentInstance.dueIsOverdue()).toBe(true);
    });
  });

  describe('assignees and labels', () => {
    it('renders up to 3 avatars and +N marker', () => {
      fixture = setupTestBed({
        task: {
          ...baseTask,
          assigneeUserIds: ['u1', 'u2', 'u3', 'u4', 'u5'],
        },
      });
      const el = fixture.nativeElement as HTMLElement;
      expect(fixture.componentInstance.avatars().length).toBe(3);
      expect(fixture.componentInstance.extraAssignees()).toBe(2);
      expect(el.textContent).toContain('+2');
    });

    it('renders assignee identity instead of raw IDs when member data is available', () => {
      fixture = setupTestBed({
        task: { ...baseTask, assigneeUserIds: ['user-alpha'] },
      });
      const avatar = (fixture.nativeElement as HTMLElement).querySelector('[aria-label^="Assignee"]');
      expect(avatar?.getAttribute('aria-label')).toContain('Alice Alpha');
      expect(avatar?.textContent).toContain('AA');
    });

    it('renders label chips by lookup', () => {
      fixture = setupTestBed({
        task: { ...baseTask, labelIds: ['l1', 'l2'] },
      });
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Bug');
      expect(el.textContent).toContain('Frontend');
    });

    it('shows subtask count when subtasks exist', () => {
      fixture = setupTestBed({
        task: {
          ...baseTask,
          subtasks: [
            { ...baseTask, id: 's1' },
            { ...baseTask, id: 's2' },
          ],
        },
      });
      expect(fixture.componentInstance.subtaskCount()).toBe(2);
    });
  });

  describe('quick-edit menu', () => {
    it('toggles menu open/close', () => {
      fixture = setupTestBed();
      const comp = fixture.componentInstance;
      expect(comp.menuOpen()).toBe(false);
      comp.toggleMenu(new MouseEvent('click'));
      expect(comp.menuOpen()).toBe(true);
    });

    it('raises the card stacking level while the menu is open', () => {
      fixture = setupTestBed();
      const comp = fixture.componentInstance;
      comp.toggleMenu(new MouseEvent('click'));
      fixture.detectChanges();
      const card = fixture.nativeElement.querySelector('[role="row"], [role="listitem"]') as HTMLElement;
      expect(card.className).toContain('z-30');
    });

    it('emits changedStatus when new status selected', () => {
      fixture = setupTestBed();
      const comp = fixture.componentInstance;
      const spy = vi.fn();
      comp.changedStatus.subscribe(spy);
      comp.emitStatus('different-status');
      expect(spy).toHaveBeenCalledWith({
        task: baseTask,
        newStatusId: 'different-status',
      });
    });

    it('does NOT emit changedStatus when same status selected', () => {
      fixture = setupTestBed();
      const comp = fixture.componentInstance;
      const spy = vi.fn();
      comp.changedStatus.subscribe(spy);
      comp.emitStatus(baseTask.statusId);
      expect(spy).not.toHaveBeenCalled();
    });

    it('emits changedPriority on priority pick', () => {
      fixture = setupTestBed();
      const comp = fixture.componentInstance;
      const spy = vi.fn();
      comp.changedPriority.subscribe(spy);
      comp.emitPriority('urgent');
      expect(spy).toHaveBeenCalledWith({ task: baseTask, newPriority: 'urgent' });
    });

    it('emits changedAssignee with add action on toggle', () => {
      fixture = setupTestBed();
      const comp = fixture.componentInstance;
      const spy = vi.fn();
      comp.changedAssignee.subscribe(spy);
      const evt = { target: { checked: true } } as unknown as Event;
      comp.toggleAssignee('user-alpha', evt);
      expect(spy).toHaveBeenCalledWith({
        task: baseTask,
        userId: 'user-alpha',
        action: 'add',
      });
    });

    it('emits changedAssignee with remove action when unchecked', () => {
      fixture = setupTestBed();
      const comp = fixture.componentInstance;
      const spy = vi.fn();
      comp.changedAssignee.subscribe(spy);
      const evt = { target: { checked: false } } as unknown as Event;
      comp.toggleAssignee('user-alpha', evt);
      expect(spy).toHaveBeenCalledWith({
        task: baseTask,
        userId: 'user-alpha',
        action: 'remove',
      });
    });
  });

  describe('type icon (internal tickets)', () => {
    it('renders a task type icon by default', () => {
      fixture = setupTestBed();
      const el = fixture.nativeElement as HTMLElement;
      const icon = el.querySelector('[data-testid="task-type-icon"]');
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute('class')).toContain('pi-check-square');
    });

    it('renders a bug icon for bug type', () => {
      fixture = setupTestBed({ task: { ...baseTask, type: 'bug' } });
      const el = fixture.nativeElement as HTMLElement;
      const icon = el.querySelector('[data-testid="task-type-icon"]');
      expect(icon?.getAttribute('class')).toContain('pi-bug');
      expect(icon?.getAttribute('class')).toContain('text-rose-400');
    });

    it('renders an incident icon for incident type', () => {
      fixture = setupTestBed({ task: { ...baseTask, type: 'incident' } });
      const el = fixture.nativeElement as HTMLElement;
      const icon = el.querySelector('[data-testid="task-type-icon"]');
      expect(icon?.getAttribute('class')).toContain('pi-exclamation-triangle');
    });

    it('renders a feature icon for feature type', () => {
      fixture = setupTestBed({ task: { ...baseTask, type: 'feature' } });
      const el = fixture.nativeElement as HTMLElement;
      const icon = el.querySelector('[data-testid="task-type-icon"]');
      expect(icon?.getAttribute('class')).toContain('pi-star');
    });

    it('exposes the type in aria-label', () => {
      fixture = setupTestBed({ task: { ...baseTask, type: 'bug' } });
      const el = fixture.nativeElement as HTMLElement;
      const card = el.querySelector('[role="row"]');
      expect(card?.getAttribute('aria-label')).toContain('Bug');
    });
  });
});
