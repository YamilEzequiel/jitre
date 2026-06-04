import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type TaskTestCaseStatus =
  | 'pending'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'skipped';

export const TASK_TEST_CASE_STATUSES: readonly TaskTestCaseStatus[] = [
  'pending',
  'passed',
  'failed',
  'blocked',
  'skipped',
] as const;

export interface TaskTestCase {
  id: string;
  workspaceId: string;
  taskId: string;
  title: string;
  precondition: string | null;
  steps: string | null;
  expected: string | null;
  status: TaskTestCaseStatus;
  order: number;
  completedByUserId: string | null;
  completedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskTestCaseBody {
  title: string;
  precondition?: string;
  steps?: string;
  expected?: string;
  order?: number;
}

export interface UpdateTaskTestCaseBody {
  title?: string;
  precondition?: string | null;
  steps?: string | null;
  expected?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TaskTestCaseApiService {
  private readonly http = inject(HttpClient);

  list(taskId: string): Promise<TaskTestCase[]> {
    return firstValueFrom(
      this.http.get<TaskTestCase[]>(
        `/api/v1/tasks/${taskId}/test-cases`,
      ),
    );
  }

  create(
    taskId: string,
    body: CreateTaskTestCaseBody,
  ): Promise<TaskTestCase> {
    return firstValueFrom(
      this.http.post<TaskTestCase>(
        `/api/v1/tasks/${taskId}/test-cases`,
        body,
      ),
    );
  }

  update(
    taskId: string,
    id: string,
    body: UpdateTaskTestCaseBody,
  ): Promise<TaskTestCase> {
    return firstValueFrom(
      this.http.patch<TaskTestCase>(
        `/api/v1/tasks/${taskId}/test-cases/${id}`,
        body,
      ),
    );
  }

  setStatus(
    taskId: string,
    id: string,
    status: TaskTestCaseStatus,
  ): Promise<TaskTestCase> {
    return firstValueFrom(
      this.http.patch<TaskTestCase>(
        `/api/v1/tasks/${taskId}/test-cases/${id}/status`,
        { status },
      ),
    );
  }

  reorder(taskId: string, orderedIds: string[]): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        `/api/v1/tasks/${taskId}/test-cases/reorder`,
        { orderedIds },
      ),
    );
  }

  remove(taskId: string, id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`/api/v1/tasks/${taskId}/test-cases/${id}`),
    );
  }
}
