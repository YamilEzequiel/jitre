import { Injectable, computed, inject } from '@angular/core';
import { createEntityStore } from './entity-store.factory';
import { TaskApiService, Task } from './task-api.service';

@Injectable({ providedIn: 'root' })
export class TaskStore {
  private readonly api = inject(TaskApiService);
  private readonly store = createEntityStore<Task>();

  readonly items = this.store.items;
  readonly byId = this.store.byId;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  constructor() {
    // Refetcher needs projectId — we look it up from current store state.
    this.store.setRefetcher(async id => {
      const existing = this.store.byId()[id];
      if (!existing) {
        throw new Error(`Task ${id} not found in store; cannot refetch without projectId`);
      }
      return this.api.getById(id, existing.projectId);
    });
  }

  load(tasks: Task[]): void {
    this.store.load(tasks);
  }

  upsert(task: Task): void {
    this.store.upsert(task);
  }

  remove(id: string): void {
    this.store.remove(id);
  }

  clear(): void {
    this.store.clear();
  }

  applyEvent(event: { type: 'created' | 'updated' | 'deleted'; id: string }): Promise<void> {
    return this.store.applyEvent(event);
  }

  byProject(projectId: string) {
    return computed(() => this.items().filter(t => t.projectId === projectId));
  }

  byAssignee(userId: string) {
    return computed(() =>
      this.items().filter(t => (t.assigneeUserIds ?? []).includes(userId)),
    );
  }

  byStatusId(statusId: string) {
    return computed(() => this.items().filter(t => t.statusId === statusId));
  }

  /**
   * Loads tasks for a single project. Replaces tasks for that project in the store
   * (other projects remain untouched).
   */
  async loadForProject(projectId: string): Promise<void> {
    const tasks = await this.api.list(projectId);
    // Keep tasks for other projects, replace this project's slice.
    const others = this.items().filter(t => t.projectId !== projectId);
    this.store.load([...others, ...tasks]);
  }

  /**
   * Clears the store on workspace switch. Project-scoped lists must be re-fetched
   * via loadForProject when a project is opened.
   */
  async onWorkspaceSwitch(_workspaceId: string): Promise<void> {
    this.store.clear();
  }
}
