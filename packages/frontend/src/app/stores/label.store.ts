import { Injectable, computed, inject } from '@angular/core';
import { createEntityStore } from './entity-store.factory';
import { LabelApiService, Label, LabelScope } from './label-api.service';

@Injectable({ providedIn: 'root' })
export class LabelStore {
  private readonly api = inject(LabelApiService);
  private readonly store = createEntityStore<Label>();

  readonly items = this.store.items;
  readonly byId = this.store.byId;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  load(labels: Label[]): void {
    this.store.load(labels);
  }

  upsert(label: Label): void {
    this.store.upsert(label);
  }

  remove(id: string): void {
    this.store.remove(id);
  }

  clear(): void {
    this.store.clear();
  }

  byScope(scope: LabelScope) {
    return computed(() => this.items().filter(l => l.scope === scope));
  }

  byProject(projectId: string) {
    return computed(() =>
      this.items().filter(l => l.projectId === projectId || l.scope === 'workspace'),
    );
  }

  async loadWorkspace(): Promise<void> {
    this.store.loading.set(true);
    this.store.error.set(null);
    try {
      const labels = await this.api.listWorkspace();
      const projectScoped = this.items().filter(l => l.scope === 'project');
      this.store.load([...projectScoped, ...labels]);
    } catch (err) {
      this.store.error.set(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      this.store.loading.set(false);
    }
  }

  async loadForProject(projectId: string): Promise<void> {
    this.store.loading.set(true);
    this.store.error.set(null);
    try {
      const labels = await this.api.listByProject(projectId);
      // Replace this project's project-scoped slice (workspace labels untouched).
      const others = this.items().filter(
        l => l.scope === 'workspace' || l.projectId !== projectId,
      );
      this.store.load([...others, ...labels]);
    } catch (err) {
      this.store.error.set(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      this.store.loading.set(false);
    }
  }
}
