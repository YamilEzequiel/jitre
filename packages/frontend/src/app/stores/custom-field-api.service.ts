import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'boolean'
  | 'user';

export type CustomFieldScope = 'workspace' | 'project';

export interface CustomFieldDefinition {
  id: string;
  workspaceId: string;
  projectId: string | null;
  scope: CustomFieldScope;
  name: string;
  type: CustomFieldType;
  options: string[] | null;
  required: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CustomFieldApiService {
  private readonly http = inject(HttpClient);

  /**
   * List custom field definitions visible to a project: both project-scoped
   * fields and workspace-wide ones. The backend's GET /custom-fields returns
   * everything for the workspace; we filter by scope here for the renderer.
   */
  async listForProject(projectId: string): Promise<CustomFieldDefinition[]> {
    const params = new HttpParams().set('projectId', projectId);
    const all = await firstValueFrom(
      this.http.get<CustomFieldDefinition[]>('/api/v1/custom-fields', { params }),
    );
    return all.filter(
      (f) => f.scope === 'workspace' || f.projectId === projectId,
    );
  }
}
