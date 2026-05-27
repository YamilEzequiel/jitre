import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface WorkflowTransition {
  id: string;
  projectId: string;
  workspaceId: string;
  fromStatusId: string;
  toStatusId: string;
  fromStatus?: { id: string; name: string; category: string };
  toStatus?: { id: string; name: string; category: string };
  requiresAssignee: boolean;
  label: string | null;
  createdAt: string;
}

export interface CreateTransitionBody {
  fromStatusId: string;
  toStatusId: string;
  requiresAssignee?: boolean;
  label?: string | null;
}

@Injectable({ providedIn: 'root' })
export class WorkflowApiService {
  private readonly http = inject(HttpClient);

  list(projectId: string): Promise<WorkflowTransition[]> {
    return firstValueFrom(
      this.http.get<WorkflowTransition[]>(`/api/v1/projects/${projectId}/workflow/transitions`),
    );
  }

  create(projectId: string, body: CreateTransitionBody): Promise<WorkflowTransition> {
    return firstValueFrom(
      this.http.post<WorkflowTransition>(`/api/v1/projects/${projectId}/workflow/transitions`, body),
    );
  }

  remove(projectId: string, id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`/api/v1/projects/${projectId}/workflow/transitions/${id}`),
    );
  }
}
