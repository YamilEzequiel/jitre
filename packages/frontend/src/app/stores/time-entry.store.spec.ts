import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeEntryStore } from './time-entry.store';
import { TimeEntryApiService, TimeEntry } from './time-entry-api.service';

const baseEntry: TimeEntry = {
  id: 'e1',
  workspaceId: 'ws1',
  taskId: 't1',
  userId: 'u1',
  durationMinutes: 60,
  date: '2026-01-01',
  description: null,
  billable: true,
  startedAt: null,
  stoppedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const entryT2: TimeEntry = { ...baseEntry, id: 'e2', taskId: 't2', durationMinutes: 30 };
const entryT1b: TimeEntry = { ...baseEntry, id: 'e3', taskId: 't1', durationMinutes: 45 };

describe('TimeEntryStore', () => {
  let store: TimeEntryStore;
  const apiMock = {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    getActiveTimer: vi.fn(),
    report: vi.fn(),
    getTaskSummary: vi.fn(),
  };

  beforeEach(() => {
    for (const fn of Object.values(apiMock)) fn.mockReset();
    TestBed.configureTestingModule({
      providers: [
        TimeEntryStore,
        { provide: TimeEntryApiService, useValue: apiMock },
      ],
    });
    store = TestBed.inject(TimeEntryStore);
  });

  it('byTaskId filters by task', () => {
    store.load([baseEntry, entryT2, entryT1b]);
    const t1 = store.byTaskId('t1')();
    expect(t1.map(e => e.id).sort()).toEqual(['e1', 'e3']);
    expect(store.byTaskId('t2')()[0].id).toBe('e2');
  });

  it('summaryForTask sums durations for the task only', () => {
    store.load([baseEntry, entryT2, entryT1b]);
    expect(store.summaryForTask('t1')()).toBe(105);
    expect(store.summaryForTask('t2')()).toBe(30);
    expect(store.summaryForTask('tX')()).toBe(0);
  });

  it('loadForTask fetches and caches; skips on subsequent calls', async () => {
    apiMock.list.mockResolvedValue([baseEntry, entryT1b]);
    await store.loadForTask('t1');
    expect(apiMock.list).toHaveBeenCalledWith({ taskId: 't1' });
    expect(store.items().length).toBe(2);
    expect(store.isTaskLoaded('t1')).toBe(true);

    await store.loadForTask('t1');
    // No second call because cache hit
    expect(apiMock.list).toHaveBeenCalledTimes(1);
  });

  it('loadForTask with force re-fetches', async () => {
    apiMock.list.mockResolvedValue([baseEntry]);
    await store.loadForTask('t1');
    await store.loadForTask('t1', true);
    expect(apiMock.list).toHaveBeenCalledTimes(2);
  });

  it('loadForTask replaces only that task\'s slice', async () => {
    store.load([entryT2]);
    apiMock.list.mockResolvedValue([baseEntry, entryT1b]);
    await store.loadForTask('t1');
    const ids = store.items().map(e => e.id).sort();
    expect(ids).toEqual(['e1', 'e2', 'e3']);
  });

  it('loadActiveTimer sets activeTimer signal', async () => {
    apiMock.getActiveTimer.mockResolvedValue(baseEntry);
    await store.loadActiveTimer();
    expect(store.activeTimer()?.id).toBe('e1');
  });

  it('loadActiveTimer handles null', async () => {
    apiMock.getActiveTimer.mockResolvedValue(null);
    await store.loadActiveTimer();
    expect(store.activeTimer()).toBeNull();
  });

  it('start sets activeTimer and upserts', async () => {
    const started: TimeEntry = { ...baseEntry, id: 'live', startedAt: '2026-01-01T00:00:00Z' };
    apiMock.startTimer.mockResolvedValue(started);
    await store.start('t1', 'working', false);
    expect(apiMock.startTimer).toHaveBeenCalledWith({
      taskId: 't1',
      description: 'working',
      billable: false,
    });
    expect(store.activeTimer()?.id).toBe('live');
    expect(store.items().some(e => e.id === 'live')).toBe(true);
  });

  it('stop clears activeTimer and upserts the resulting entry', async () => {
    const started: TimeEntry = { ...baseEntry, id: 'live', startedAt: '2026-01-01T00:00:00Z' };
    const stopped: TimeEntry = {
      ...started,
      durationMinutes: 30,
      stoppedAt: '2026-01-01T00:30:00Z',
    };
    apiMock.startTimer.mockResolvedValue(started);
    apiMock.stopTimer.mockResolvedValue(stopped);
    await store.start('t1');
    await store.stop();
    expect(store.activeTimer()).toBeNull();
    expect(store.byId()['live'].durationMinutes).toBe(30);
  });

  it('create upserts the returned entry', async () => {
    apiMock.create.mockResolvedValue(baseEntry);
    await store.create({ taskId: 't1', durationMinutes: 60, date: '2026-01-01' });
    expect(store.byId()['e1']).toBeDefined();
  });

  it('update upserts and syncs activeTimer if active', async () => {
    store.load([baseEntry]);
    // Force active timer to e1 by simulating start having set it
    apiMock.startTimer.mockResolvedValue(baseEntry);
    await store.start('t1');
    const patched: TimeEntry = { ...baseEntry, description: 'edited' };
    apiMock.update.mockResolvedValue(patched);
    await store.update('e1', { description: 'edited' });
    expect(store.byId()['e1'].description).toBe('edited');
    expect(store.activeTimer()?.description).toBe('edited');
  });

  it('delete removes and clears activeTimer if same id', async () => {
    apiMock.startTimer.mockResolvedValue(baseEntry);
    await store.start('t1');
    apiMock.delete.mockResolvedValue(undefined);
    await store.delete('e1');
    expect(store.byId()['e1']).toBeUndefined();
    expect(store.activeTimer()).toBeNull();
  });

  it('clear resets everything', async () => {
    store.load([baseEntry]);
    apiMock.startTimer.mockResolvedValue(baseEntry);
    await store.start('t1');
    store.clear();
    expect(store.items()).toEqual([]);
    expect(store.activeTimer()).toBeNull();
    expect(store.isTaskLoaded('t1')).toBe(false);
  });
});
