import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type TaskChecklistItemStatus =
  | 'pending'
  | 'passed'
  | 'failed'
  | 'blocked';

export const TASK_CHECKLIST_ITEM_STATUSES: readonly TaskChecklistItemStatus[] = [
  'pending',
  'passed',
  'failed',
  'blocked',
] as const;

export interface TaskChecklistItem {
  id: string;
  workspaceId: string;
  taskId: string;
  content: string;
  status: TaskChecklistItemStatus;
  order: number;
  completedByUserId: string | null;
  completedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskChecklistItemBody {
  content: string;
  order?: number;
}

export interface UpdateTaskChecklistItemBody {
  content?: string;
}

@Injectable({ providedIn: 'root' })
export class TaskChecklistApiService {
  private readonly http = inject(HttpClient);

  list(taskId: string): Promise<TaskChecklistItem[]> {
    return firstValueFrom(
      this.http.get<TaskChecklistItem[]>(
        `/api/v1/tasks/${taskId}/checklist`,
      ),
    );
  }

  create(
    taskId: string,
    body: CreateTaskChecklistItemBody,
  ): Promise<TaskChecklistItem> {
    return firstValueFrom(
      this.http.post<TaskChecklistItem>(
        `/api/v1/tasks/${taskId}/checklist`,
        body,
      ),
    );
  }

  update(
    taskId: string,
    id: string,
    body: UpdateTaskChecklistItemBody,
  ): Promise<TaskChecklistItem> {
    return firstValueFrom(
      this.http.patch<TaskChecklistItem>(
        `/api/v1/tasks/${taskId}/checklist/${id}`,
        body,
      ),
    );
  }

  setStatus(
    taskId: string,
    id: string,
    status: TaskChecklistItemStatus,
  ): Promise<TaskChecklistItem> {
    return firstValueFrom(
      this.http.patch<TaskChecklistItem>(
        `/api/v1/tasks/${taskId}/checklist/${id}/status`,
        { status },
      ),
    );
  }

  reorder(taskId: string, orderedIds: string[]): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        `/api/v1/tasks/${taskId}/checklist/reorder`,
        { orderedIds },
      ),
    );
  }

  remove(taskId: string, id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`/api/v1/tasks/${taskId}/checklist/${id}`),
    );
  }
}
