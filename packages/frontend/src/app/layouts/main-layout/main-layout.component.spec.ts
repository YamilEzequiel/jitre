import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MainLayoutComponent } from './main-layout.component';
import { KeyboardShortcutService } from '../../core/keyboard/keyboard-shortcut.service';
import { CommandPaletteService } from '../../shared/command-palette/command-palette.service';
import { ToastService } from '../../core/toast/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { TimeEntryStore } from '../../stores/time-entry.store';
import { TaskStore } from '../../stores/task.store';
import { ChatChannelStore } from '../../stores/chat-channel.store';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import type { TimeEntry } from '../../stores/time-entry-api.service';

const sampleActive: TimeEntry = {
  id: 'live',
  workspaceId: 'ws1',
  taskId: 't1',
  userId: 'u1',
  durationMinutes: 0,
  date: '2026-01-01',
  description: 'in flight',
  billable: true,
  startedAt: new Date(Date.now() - 65_000).toISOString(),
  stoppedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function setup(opts: { active?: TimeEntry | null; role?: 'admin' | 'member' } = {}) {
  const activeTimer = signal<TimeEntry | null>(opts.active ?? null);
  const tasksById = signal<Record<string, { title: string }>>({ t1: { title: 'My Task' } });

  const openMock = vi.fn();
  const registerMock = vi.fn().mockReturnValue(() => undefined);
  const stopMock = vi.fn().mockImplementation(async () => {
    activeTimer.set(null);
  });

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: KeyboardShortcutService, useValue: { register: registerMock, getAll: vi.fn().mockReturnValue([]) } },
      {
        provide: CommandPaletteService,
        useValue: {
          isOpen: signal(false).asReadonly(),
          open: openMock,
          close: vi.fn(),
          search: vi.fn().mockResolvedValue([]),
          recents: { get: vi.fn().mockReturnValue([]), add: vi.fn(), clear: vi.fn() },
        },
      },
      {
        provide: ToastService,
        useValue: {
          toasts: signal([]).asReadonly(),
          dismiss: vi.fn(),
          success: vi.fn(),
          error: vi.fn(),
        },
      },
      {
        provide: ChatChannelStore,
        useValue: { totalUnread: signal(0).asReadonly() },
      },
      {
        provide: AuthService,
        useValue: {
          currentUser: signal({
            id: 'u1',
            email: 'u@x',
            displayName: 'U',
            role: opts.role ?? 'admin',
          }),
        },
      },
      {
        provide: TimeEntryStore,
        useValue: {
          activeTimer: activeTimer.asReadonly(),
          loadActiveTimer: vi.fn().mockResolvedValue(undefined),
          stop: stopMock,
        },
      },
      {
        provide: TaskStore,
        useValue: { byId: tasksById.asReadonly() },
      },
    ],
  });

  const fixture = TestBed.createComponent(MainLayoutComponent);
  fixture.detectChanges();
  return { fixture, activeTimer, stopMock, openMock, registerMock };
}

describe('MainLayoutComponent', () => {
  let fixture: ComponentFixture<MainLayoutComponent>;

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    ({ fixture } = setup());
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders router-outlet', () => {
    ({ fixture } = setup());
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('router-outlet')).toBeTruthy();
  });

  it('renders compact product navigation and header actions', () => {
    ({ fixture } = setup({ role: 'admin' }));
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('AI Insights');
    expect(text).toContain('Automations');
    expect(text).toContain('Chat');
    expect(text).toContain('Support');
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-label="Notifications"]')).toBeTruthy();
  });

  it('registers cmd+k shortcut on init', () => {
    const { registerMock } = setup();
    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'cmd+k' }),
    );
  });

  it('does not show timer pill when no active timer', () => {
    ({ fixture } = setup());
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="active-timer-pill"]')).toBeNull();
  });

  it('renders timer pill when active timer is present', () => {
    ({ fixture } = setup({ active: sampleActive }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="active-timer-pill"]')).toBeTruthy();
    expect(el.textContent).toContain('My Task');
  });

  it('timerLabel formats running time as H:MM:SS', () => {
    const { fixture: f } = setup({ active: sampleActive });
    // Started ~65s ago — label should be "0:01:05" roughly
    expect(f.componentInstance.timerLabel()).toMatch(/^0:01:0\d$/);
  });

  it('stopTimer calls store.stop', async () => {
    const { fixture: f, stopMock } = setup({ active: sampleActive });
    await f.componentInstance.stopTimer();
    expect(stopMock).toHaveBeenCalled();
  });

  it('goToTimerTask navigates to the active task', () => {
    const { fixture: f } = setup({ active: sampleActive });
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    f.componentInstance.goToTimerTask();
    expect(spy).toHaveBeenCalledWith(['/tasks', 't1']);
  });

  it('hides Time Reports link for non-admin', () => {
    ({ fixture } = setup({ role: 'member' }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Time Reports');
  });

  it('shows Time Reports link for admin', () => {
    ({ fixture } = setup({ role: 'admin' }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Time Reports');
  });
});
