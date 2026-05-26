import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type LabelScope = 'workspace' | 'project';

export interface Label {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  name: string;
  color?: string | null;
  scope: LabelScope;
}

export interface CreateLabelBody {
  name: string;
  scope: LabelScope;
  color?: string | null;
  projectId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class LabelApiService {
  private readonly http = inject(HttpClient);

  listWorkspace(): Promise<Label[]> {
    return firstValueFrom(this.http.get<Label[]>('/api/v1/labels'));
  }

  listByProject(projectId: string): Promise<Label[]> {
    return firstValueFrom(
      this.http.get<Label[]>(`/api/v1/projects/${projectId}/labels`),
    );
  }

  create(body: CreateLabelBody): Promise<Label> {
    return firstValueFrom(this.http.post<Label>('/api/v1/labels', body));
  }
}
