import { Injectable, computed, inject } from '@angular/core';
import { createEntityStore } from './entity-store.factory';
import { WorkflowStatusApiService, WorkflowStatus } from './workflow-status-api.service';

@Injectable({ providedIn: 'root' })
export class WorkflowStatusStore {
  private readonly api = inject(WorkflowStatusApiService);
  private readonly store = createEntityStore<WorkflowStatus>();

  readonly items = this.store.items;
  readonly byId = this.store.byId;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  load(statuses: WorkflowStatus[]): void {
    this.store.load(statuses);
  }

  upsert(status: WorkflowStatus): void {
    this.store.upsert(status);
  }

  remove(id: string): void {
    this.store.remove(id);
  }

  clear(): void {
    this.store.clear();
  }

  /**
   * Returns statuses visible to a project (project-scoped + workspace defaults
   * which have projectId === null), sorted by `order` ascending.
   */
  byProject(projectId: string) {
    return computed(() =>
      this.items()
        .filter(s => s.projectId === projectId || s.projectId === null)
        .slice()
        .sort((a, b) => a.order - b.order),
    );
  }

  async loadForProject(projectId: string): Promise<void> {
    this.store.loading.set(true);
    this.store.error.set(null);
    try {
      const statuses = await this.api.listByProject(projectId);
      // Replace project-scoped + defaults slice while keeping any other project's data.
      const others = this.items().filter(
        s => s.projectId !== projectId && s.projectId !== null,
      );
      this.store.load([...others, ...statuses]);
    } catch (err) {
      this.store.error.set(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      this.store.loading.set(false);
    }
  }
}
