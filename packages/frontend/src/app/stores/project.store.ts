import { Injectable, inject } from '@angular/core';
import { createEntityStore } from './entity-store.factory';
import { ProjectApiService, Project } from './project-api.service';

@Injectable({ providedIn: 'root' })
export class ProjectStore {
  private readonly api = inject(ProjectApiService);
  private readonly store = createEntityStore<Project>();

  readonly items = this.store.items;
  readonly byId = this.store.byId;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  constructor() {
    this.store.setRefetcher(id => this.api.getById(id));
  }

  load(projects: Project[]): void {
    this.store.load(projects);
  }

  upsert(project: Project): void {
    this.store.upsert(project);
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

  async onWorkspaceSwitch(workspaceId: string): Promise<void> {
    this.store.clear();
    const projects = await this.api.list(workspaceId);
    this.store.load(projects);
  }

  async loadById(id: string): Promise<void> {
    const project = await this.api.getById(id);
    this.store.upsert(project);
  }
}
