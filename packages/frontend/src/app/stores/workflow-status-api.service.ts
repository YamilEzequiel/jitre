import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type StatusCategory = 'todo' | 'in_progress' | 'done';

export interface WorkflowStatus {
  id: string;
  projectId: string | null;
  workspaceId: string;
  name: string;
  category: StatusCategory;
  color?: string | null;
  order: number;
  isDefault: boolean;
}

export interface CreateWorkflowStatusBody {
  name: string;
  category: StatusCategory;
  isDefault?: boolean;
  order?: number;
  color?: string | null;
}

export type UpdateWorkflowStatusBody = Partial<CreateWorkflowStatusBody>;

@Injectable({ providedIn: 'root' })
export class WorkflowStatusApiService {
  private readonly http = inject(HttpClient);

  listByProject(projectId: string): Promise<WorkflowStatus[]> {
    return firstValueFrom(
      this.http.get<WorkflowStatus[]>(`/api/v1/projects/${projectId}/statuses`),
    );
  }

  create(projectId: string, body: CreateWorkflowStatusBody): Promise<WorkflowStatus> {
    return firstValueFrom(
      this.http.post<WorkflowStatus>(`/api/v1/projects/${projectId}/statuses`, body),
    );
  }

  update(id: string, body: UpdateWorkflowStatusBody): Promise<WorkflowStatus> {
    return firstValueFrom(
      this.http.patch<WorkflowStatus>(`/api/v1/statuses/${id}`, body),
    );
  }

  delete(id: string, replaceWithStatusId?: string): Promise<void> {
    return firstValueFrom(
      this.http.request<void>('DELETE', `/api/v1/statuses/${id}`, {
        body: replaceWithStatusId ? { replaceWithStatusId } : {},
      }),
    );
  }
}
