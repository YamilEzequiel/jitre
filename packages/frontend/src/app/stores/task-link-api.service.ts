import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type TaskLinkType = 'blocks' | 'relates_to' | 'duplicates' | 'clones';

export const TASK_LINK_TYPES: readonly TaskLinkType[] = [
  'blocks',
  'relates_to',
  'duplicates',
  'clones',
] as const;

export interface HydratedTaskLink {
  id: string;
  direction: 'outgoing' | 'incoming';
  linkType: TaskLinkType;
  otherTaskId: string;
  otherTaskTitle: string | null;
  createdAt: string;
}

export interface CreateTaskLinkBody {
  targetTaskId: string;
  linkType: TaskLinkType;
}

@Injectable({ providedIn: 'root' })
export class TaskLinkApiService {
  private readonly http = inject(HttpClient);

  list(taskId: string): Promise<HydratedTaskLink[]> {
    return firstValueFrom(
      this.http.get<HydratedTaskLink[]>(`/api/v1/tasks/${taskId}/links`),
    );
  }

  create(taskId: string, body: CreateTaskLinkBody): Promise<unknown> {
    return firstValueFrom(this.http.post(`/api/v1/tasks/${taskId}/links`, body));
  }

  remove(taskId: string, linkId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`/api/v1/tasks/${taskId}/links/${linkId}`),
    );
  }
}
