import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'task' | 'bug' | 'incident' | 'feature';

export interface Task {
  id: string;
  projectId: string;
  workspaceId: string;
  statusId: string;
  title: string;
  issueNumber?: number | null;
  issueKey?: string | null;
  description?: string | null;
  priority: TaskPriority;
  type: TaskType;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedHours?: number | null;
  parentTaskId?: string | null;
  epicId?: string | null;
  sprintId?: string | null;
  releaseId?: string | null;
  rank: string;
  customFields?: Record<string, unknown>;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // populated when requested:
  assigneeUserIds?: string[];
  labelIds?: string[];
  subtasks?: Task[];
}

export interface TaskListFilters {
  statusId?: string;
  assigneeUserId?: string;
  labelId?: string;
  priority?: TaskPriority;
  type?: TaskType;
  q?: string;
  page?: number;
  limit?: number;
}

export interface CreateTaskBody {
  title: string;
  statusId: string;
  parentTaskId?: string | null;
  epicId?: string | null;
  sprintId?: string | null;
  releaseId?: string | null;
  assigneeUserIds?: string[];
  labelIds?: string[];
  priority?: TaskPriority;
  type?: TaskType;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedHours?: number | null;
  description?: string | null;
  customFields?: Record<string, unknown>;
}

export type UpdateTaskBody = Partial<
  Pick<
    Task,
    'title' | 'description' | 'priority' | 'type' | 'dueDate' | 'startDate' | 'estimatedHours' | 'customFields' | 'epicId' | 'sprintId' | 'releaseId'
  >
>;

export interface ReorderPosition {
  beforeId?: string;
  afterId?: string;
}

@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly http = inject(HttpClient);

  getById(id: string, projectId?: string): Promise<Task> {
    const url = projectId
      ? `/api/v1/projects/${projectId}/tasks/${id}`
      : `/api/v1/tasks/${id}`;
    return firstValueFrom(
      this.http.get<Task>(url),
    );
  }

  list(projectId: string, filters?: TaskListFilters): Promise<Task[]> {
    let params = new HttpParams();
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, String(value));
        }
      }
    }
    return firstValueFrom(
      this.http.get<Task[]>(`/api/v1/projects/${projectId}/tasks`, { params }),
    );
  }

  create(projectId: string, body: CreateTaskBody): Promise<Task> {
    return firstValueFrom(
      this.http.post<Task>(`/api/v1/projects/${projectId}/tasks`, body),
    );
  }

  update(projectId: string, id: string, patch: UpdateTaskBody): Promise<Task> {
    return firstValueFrom(
      this.http.patch<Task>(`/api/v1/projects/${projectId}/tasks/${id}`, patch),
    );
  }

  changeStatus(projectId: string, id: string, statusId: string): Promise<Task> {
    return firstValueFrom(
      this.http.patch<Task>(
        `/api/v1/projects/${projectId}/tasks/${id}/status`,
        { statusId },
      ),
    );
  }

  reorder(projectId: string, id: string, position: ReorderPosition): Promise<Task> {
    return firstValueFrom(
      this.http.patch<Task>(
        `/api/v1/projects/${projectId}/tasks/${id}/reorder`,
        position,
      ),
    );
  }

  addAssignee(projectId: string, id: string, userId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post<unknown>(
        `/api/v1/projects/${projectId}/tasks/${id}/assignees`,
        { userId },
      ),
    );
  }

  removeAssignee(projectId: string, id: string, userId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        `/api/v1/projects/${projectId}/tasks/${id}/assignees/${userId}`,
      ),
    );
  }

  addLabel(projectId: string, id: string, labelId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post<unknown>(
        `/api/v1/projects/${projectId}/tasks/${id}/labels`,
        { labelId },
      ),
    );
  }

  removeLabel(projectId: string, id: string, labelId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        `/api/v1/projects/${projectId}/tasks/${id}/labels/${labelId}`,
      ),
    );
  }
}
