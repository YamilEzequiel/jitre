import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TimeLoggerComponent } from './time-logger.component';
import { TimeEntryStore } from '../../stores/time-entry.store';
import { TimeEntry } from '../../stores/time-entry-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceMemberStore } from '../../stores/workspace-member.store';

const sampleEntry: TimeEntry = {
  id: 'e1',
  workspaceId: 'ws1',
  taskId: 't1',
  userId: 'u-me',
  durationMinutes: 90,
  date: '2026-01-01',
  description: 'pair session',
  billable: true,
  startedAt: null,
  stoppedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const otherUserEntry: TimeEntry = {
  ...sampleEntry,
  id: 'e2',
  userId: 'u-other',
  durationMinutes: 30,
  description: null,
  billable: false,
};

function setupTestBed(opts: {
  compact?: boolean;
  entries?: TimeEntry[];
  activeTimer?: TimeEntry | null;
  isAdmin?: boolean;
} = {}) {
  const entries = signal<TimeEntry[]>(opts.entries ?? []);
  const activeTimer = signal<TimeEntry | null>(opts.activeTimer ?? null);

  const storeMock = {
    items: entries,
    activeTimer: activeTimer.asReadonly(),
    isTaskLoaded: vi.fn().mockReturnValue(true),
    loadForTask: vi.fn().mockResolvedValue(undefined),
    summaryForTask: (tid: string) => () =>
      entries().filter(e => e.taskId === tid).reduce((a, e) => a + e.durationMinutes, 0),
    create: vi.fn().mockImplementation(async (body: { taskId: string; durationMinutes: number; date: string; description?: string | null; billable?: boolean }) => {
      const created: TimeEntry = {
        ...sampleEntry,
        id: 'created-' + Math.random().toString(36).slice(2),
        taskId: body.taskId,
        durationMinutes: body.durationMinutes,
        date: body.date,
        description: body.description ?? null,
        billable: !!body.billable,
      };
      entries.update(arr => [...arr, created]);
      return created;
    }),
    start: vi.fn().mockImplementation(async (taskId: string) => {
      const started: TimeEntry = { ...sampleEntry, id: 'live', taskId, startedAt: '2026-01-01T00:00:00Z' };
      activeTimer.set(started);
      return started;
    }),
    stop: vi.fn().mockImplementation(async () => {
      const current = activeTimer();
      const stopped: TimeEntry = { ...sampleEntry, id: current?.id ?? 'live', stoppedAt: '2026-01-01T01:00:00Z' };
      activeTimer.set(null);
      return stopped;
    }),
    delete: vi.fn().mockImplementation(async (id: string) => {
      entries.update(arr => arr.filter(e => e.id !== id));
    }),
  };

  const authMock = {
    currentUser: signal(
      opts.isAdmin
        ? { id: 'u-me', email: 'me@x', displayName: 'Me Admin', role: 'admin' as const }
        : { id: 'u-me', email: 'me@x', displayName: 'Me Member', role: 'member' as const },
    ),
  };

  const toastMock = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: TimeEntryStore, useValue: storeMock },
      { provide: AuthService, useValue: authMock },
      { provide: ToastService, useValue: toastMock },
      {
        provide: WorkspaceMemberStore,
        useValue: {
          initialsFor: (id: string) => id.slice(0, 2).toUpperCase(),
          displayNameFor: (id: string) => id,
          memberFor: () => null,
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(TimeLoggerComponent);
  fixture.componentRef.setInput('taskId', 't1');
  if (opts.compact !== undefined) fixture.componentRef.setInput('compact', opts.compact);
  fixture.detectChanges();
  return { fixture, storeMock, authMock, toastMock };
}

describe('TimeLoggerComponent', () => {
  let fixture: ComponentFixture<TimeLoggerComponent>;

  afterEach(() => TestBed.resetTestingModule());

  it('shows "0m" when no entries', () => {
    ({ fixture } = setupTestBed());
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="time-total"]')?.textContent?.trim()).toContain('0m');
  });

  it('shows total formatted from entries', () => {
    ({ fixture } = setupTestBed({ entries: [sampleEntry, otherUserEntry] }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="time-total"]')?.textContent?.trim()).toContain('2h');
  });

  it('renders entries when not compact', () => {
    ({ fixture } = setupTestBed({ entries: [sampleEntry] }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('pair session');
    expect(el.textContent).toContain('1h 30m');
  });

  it('shows empty state when no entries (non-compact)', () => {
    ({ fixture } = setupTestBed());
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No time logged');
  });

  it('logs valid duration and calls store.create', async () => {
    const { fixture: f, storeMock } = setupTestBed();
    const comp = f.componentInstance;
    comp.form.patchValue({ duration: '1h 30m', description: 'work', billable: true });
    await comp.onLog();
    expect(storeMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 't1',
        durationMinutes: 90,
        description: 'work',
        billable: true,
      }),
    );
  });

  it('rejects invalid duration and shows error', async () => {
    const { fixture: f, storeMock, toastMock } = setupTestBed();
    const comp = f.componentInstance;
    comp.form.patchValue({ duration: 'abc' });
    await comp.onLog();
    expect(storeMock.create).not.toHaveBeenCalled();
    expect(comp.durationError()).toMatch(/invalid/i);
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('start timer calls store.start and shows toast', async () => {
    const { fixture: f, storeMock, toastMock } = setupTestBed();
    const comp = f.componentInstance;
    await comp.onStart();
    expect(storeMock.start).toHaveBeenCalledWith('t1', null, true);
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('shows "Timer running" pill when active timer is on this task', () => {
    const active: TimeEntry = { ...sampleEntry, id: 'live', startedAt: '2026-01-01T00:00:00Z' };
    ({ fixture } = setupTestBed({ activeTimer: active }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Timer running');
  });

  it('shows other-task warning when timer runs on a different task', () => {
    const active: TimeEntry = {
      ...sampleEntry,
      id: 'live',
      taskId: 't-other',
      startedAt: '2026-01-01T00:00:00Z',
    };
    ({ fixture } = setupTestBed({ activeTimer: active }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="other-task-warning"]')).toBeTruthy();
  });

  it('stop timer calls store.stop', async () => {
    const active: TimeEntry = { ...sampleEntry, id: 'live', startedAt: '2026-01-01T00:00:00Z' };
    const { fixture: f, storeMock } = setupTestBed({ activeTimer: active });
    await f.componentInstance.onStop();
    expect(storeMock.stop).toHaveBeenCalled();
  });

  it('non-admin cannot edit other users\' entries', () => {
    const { fixture: f } = setupTestBed({ entries: [otherUserEntry] });
    const canEdit = f.componentInstance.canEditEntry(otherUserEntry);
    expect(canEdit).toBe(false);
  });

  it('admin can edit any entry', () => {
    const { fixture: f } = setupTestBed({ entries: [otherUserEntry], isAdmin: true });
    expect(f.componentInstance.canEditEntry(otherUserEntry)).toBe(true);
  });

  it('user can delete own entry', async () => {
    const { fixture: f, storeMock } = setupTestBed({ entries: [sampleEntry] });
    await f.componentInstance.onDelete(sampleEntry);
    expect(storeMock.delete).toHaveBeenCalledWith('e1');
  });

  it('compact mode renders without entries list and shows quick log toggle', () => {
    ({ fixture } = setupTestBed({ compact: true, entries: [sampleEntry] }));
    const el = fixture.nativeElement as HTMLElement;
    // No entries list rendered in compact mode (no description text from entry)
    expect(el.textContent).not.toContain('pair session');
    expect(el.textContent).toContain('Log');
  });
});
