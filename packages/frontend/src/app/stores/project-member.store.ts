import { Injectable, computed, inject } from '@angular/core';
import { createEntityStore } from './entity-store.factory';
import { ProjectMemberApiService, ProjectMember } from './project-member-api.service';

@Injectable({ providedIn: 'root' })
export class ProjectMemberStore {
  private readonly api = inject(ProjectMemberApiService);
  private readonly store = createEntityStore<ProjectMember>();

  readonly items = this.store.items;
  readonly byId = this.store.byId;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  load(members: ProjectMember[]): void {
    this.store.load(members);
  }

  upsert(member: ProjectMember): void {
    this.store.upsert(member);
  }

  remove(id: string): void {
    this.store.remove(id);
  }

  clear(): void {
    this.store.clear();
  }

  byProject(projectId: string) {
    return computed(() => this.items().filter(m => m.projectId === projectId));
  }

  async loadForProject(projectId: string): Promise<void> {
    this.store.loading.set(true);
    this.store.error.set(null);
    try {
      const members = await this.api.listByProject(projectId);
      const others = this.items().filter(m => m.projectId !== projectId);
      this.store.load([...others, ...members]);
    } catch (err) {
      this.store.error.set(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      this.store.loading.set(false);
    }
  }
}
