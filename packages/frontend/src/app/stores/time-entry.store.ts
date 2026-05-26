import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { createEntityStore } from './entity-store.factory';
import {
  TimeEntry,
  TimeEntryApiService,
  StartTimerBody,
  CreateTimeEntryBody,
  UpdateTimeEntryBody,
} from './time-entry-api.service';

@Injectable({ providedIn: 'root' })
export class TimeEntryStore {
  private readonly api = inject(TimeEntryApiService);
  private readonly store = createEntityStore<TimeEntry>();

  private readonly _activeTimer = signal<TimeEntry | null>(null);
  private readonly _loadedTaskIds = signal<Set<string>>(new Set<string>());
  private readonly _stopping = signal(false);
  private _stopInFlight: Promise<TimeEntry | null> | null = null;

  readonly stopping = this._stopping.asReadonly();

  readonly items = this.store.items;
  readonly byId = this.store.byId;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly activeTimer = this._activeTimer.asReadonly();

  constructor() {
    this.store.setRefetcher(id => this.api.getById(id));
  }

  load(entries: TimeEntry[]): void {
    this.store.load(entries);
  }

  upsert(entry: TimeEntry): void {
    this.store.upsert(entry);
  }

  remove(id: string): void {
    this.store.remove(id);
    if (this._activeTimer()?.id === id) {
      this._activeTimer.set(null);
    }
  }

  clear(): void {
    this.store.clear();
    this._activeTimer.set(null);
    this._loadedTaskIds.set(new Set<string>());
  }

  byTaskId(taskId: string) {
    return computed(() => this.items().filter(e => e.taskId === taskId));
  }

  summaryForTask(taskId: string) {
    return computed(() =>
      this.items()
        .filter(e => e.taskId === taskId)
        .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0),
    );
  }

  isTaskLoaded(taskId: string): boolean {
    return this._loadedTaskIds().has(taskId);
  }

  async loadForTask(taskId: string, force = false): Promise<void> {
    if (!force && this.isTaskLoaded(taskId)) return;
    this.store.loading.set(true);
    this.store.error.set(null);
    try {
      const entries = await this.api.list({ taskId });
      // Replace this task's slice, keep others.
      const others = this.items().filter(e => e.taskId !== taskId);
      this.store.load([...others, ...entries]);
      this._loadedTaskIds.update(s => {
        const next = new Set(s);
        next.add(taskId);
        return next;
      });
    } catch (err) {
      this.store.error.set(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      this.store.loading.set(false);
    }
  }

  async loadActiveTimer(): Promise<void> {
    try {
      const timer = await this.api.getActiveTimer();
      this._activeTimer.set(timer);
    } catch {
      this._activeTimer.set(null);
    }
  }

  async create(body: CreateTimeEntryBody): Promise<TimeEntry> {
    const created = await this.api.create(body);
    this.store.upsert(created);
    return created;
  }

  async update(id: string, patch: UpdateTimeEntryBody): Promise<TimeEntry> {
    const updated = await this.api.update(id, patch);
    this.store.upsert(updated);
    if (this._activeTimer()?.id === id) {
      this._activeTimer.set(updated);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.api.delete(id);
    this.remove(id);
  }

  async start(taskId: string, description?: string | null, billable?: boolean): Promise<TimeEntry> {
    const body: StartTimerBody = { taskId, description, billable };
    const entry = await this.api.startTimer(body);
    this._activeTimer.set(entry);
    this.store.upsert(entry);
    return entry;
  }

  async stop(): Promise<TimeEntry | null> {
    // Coalesce concurrent stop calls so two visible Stop buttons (header pill +
    // task time-logger) can't fire duplicate requests.
    if (this._stopInFlight) return this._stopInFlight;
    if (!this._activeTimer()) return null;

    this._stopping.set(true);
    this._stopInFlight = (async () => {
      try {
        const entry = await this.api.stopTimer();
        this._activeTimer.set(null);
        this.store.upsert(entry);
        return entry;
      } catch (err) {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this._activeTimer.set(null);
          return null;
        }
        throw err;
      } finally {
        this._stopInFlight = null;
        this._stopping.set(false);
      }
    })();
    return this._stopInFlight;
  }

  applyEvent(event: { type: 'created' | 'updated' | 'deleted'; id: string }): Promise<void> {
    return this.store.applyEvent(event);
  }
}
