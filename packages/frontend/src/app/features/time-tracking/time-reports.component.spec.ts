import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { TimeReportsComponent } from './time-reports.component';
import { TimeEntryApiService, TimeReportRow } from '../../stores/time-entry-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceMemberStore } from '../../stores/workspace-member.store';

const sampleRows: TimeReportRow[] = [
  { groupKey: 'u-alice', totalMinutes: 240, entryCount: 4 },
  { groupKey: 'u-bob', totalMinutes: 120, entryCount: 2 },
];

function setup(opts: { admin?: boolean; myTimeOnly?: boolean } = {}) {
  const apiMock = {
    report: vi.fn().mockResolvedValue(sampleRows),
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getById: vi.fn(),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    getActiveTimer: vi.fn(),
    getTaskSummary: vi.fn(),
  };

  const authMock = {
    currentUser: signal({
      id: 'u-me',
      email: 'me@x',
      displayName: 'Me',
      role: (opts.admin ?? true) ? ('admin' as const) : ('member' as const),
    }),
  };

  const routerMock = { navigateByUrl: vi.fn() };

  const toastMock = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: TimeEntryApiService, useValue: apiMock },
      { provide: AuthService, useValue: authMock },
      { provide: ToastService, useValue: toastMock },
      { provide: Router, useValue: routerMock },
      {
        provide: WorkspaceMemberStore,
        useValue: { displayNameFor: (id: string, fb?: string) => fb ?? id },
      },
    ],
  });

  const fixture = TestBed.createComponent(TimeReportsComponent);
  if (opts.myTimeOnly !== undefined) {
    fixture.componentRef.setInput('myTimeOnly', opts.myTimeOnly);
  }
  fixture.detectChanges();
  return { fixture, apiMock, authMock, routerMock, toastMock };
}

describe('TimeReportsComponent', () => {
  let fixture: ComponentFixture<TimeReportsComponent>;

  afterEach(() => TestBed.resetTestingModule());

  it('loads report on init (admin)', async () => {
    const { fixture: f, apiMock } = setup({ admin: true });
    await f.whenStable();
    expect(apiMock.report).toHaveBeenCalled();
  });

  it('non-admin sees gate blocked and redirect is scheduled', async () => {
    vi.useFakeTimers();
    const { fixture: f, routerMock, apiMock } = setup({ admin: false });
    fixture = f;
    expect(f.componentInstance.gateBlocked()).toBe(true);
    // Report not loaded
    expect(apiMock.report).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/');
    vi.useRealTimers();
  });

  it('myTimeOnly mode allows non-admin and passes userId', async () => {
    const { fixture: f, apiMock } = setup({ admin: false, myTimeOnly: true });
    await f.whenStable();
    expect(f.componentInstance.gateBlocked()).toBe(false);
    expect(apiMock.report).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-me' }),
    );
  });

  it('setGroupBy triggers reload with new groupBy', async () => {
    const { fixture: f, apiMock } = setup({ admin: true });
    await f.whenStable();
    apiMock.report.mockClear();
    f.componentInstance.setGroupBy('project');
    await f.whenStable();
    expect(apiMock.report).toHaveBeenCalledWith(
      expect.objectContaining({ groupBy: 'project' }),
    );
  });

  it('summary computes total, entries, and top contributor', async () => {
    const { fixture: f } = setup({ admin: true });
    await f.whenStable();
    f.componentInstance.rows.set(sampleRows);
    const s = f.componentInstance.summary();
    expect(s.totalMinutes).toBe(360);
    expect(s.totalEntries).toBe(6);
    expect(s.topContributor?.groupKey).toBe('u-alice');
  });

  it('rowPct returns 100 for the max row', async () => {
    const { fixture: f } = setup({ admin: true });
    await f.whenStable();
    f.componentInstance.rows.set(sampleRows);
    expect(f.componentInstance.rowPct(sampleRows[0])).toBe(100);
    expect(f.componentInstance.rowPct(sampleRows[1])).toBe(50);
  });

  it('drilldown loads entries with correct filter for groupBy=user', async () => {
    const { fixture: f, apiMock } = setup({ admin: true });
    await f.whenStable();
    await f.componentInstance.drilldown(sampleRows[0]);
    expect(apiMock.list).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-alice' }),
    );
    expect(f.componentInstance.drilldownRow()?.groupKey).toBe('u-alice');
  });

  it('closeDrilldown clears state', async () => {
    const { fixture: f } = setup({ admin: true });
    await f.whenStable();
    f.componentInstance.drilldownRow.set(sampleRows[0]);
    f.componentInstance.drilldownEntries.set([]);
    f.componentInstance.closeDrilldown();
    expect(f.componentInstance.drilldownRow()).toBeNull();
  });

  it('exportCsv is a no-op when rows are empty', async () => {
    const { fixture: f } = setup({ admin: true });
    await f.whenStable();
    f.componentInstance.rows.set([]);
    const spy = vi.spyOn(URL, 'createObjectURL');
    f.componentInstance.exportCsv();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
