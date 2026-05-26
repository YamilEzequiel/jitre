import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);

  readonly loading = {
    describe: signal(false),
    suggestSubtasks: signal(false),
    summary: signal(false),
  };

  async describeTask(taskId: string): Promise<unknown> {
    this.loading.describe.set(true);
    try {
      return await firstValueFrom(
        this.http.post(`/api/v1/ai/tasks/${taskId}/describe`, {}),
      );
    } finally {
      this.loading.describe.set(false);
    }
  }

  async suggestSubtasks(taskId: string): Promise<unknown> {
    this.loading.suggestSubtasks.set(true);
    try {
      return await firstValueFrom(
        this.http.post(`/api/v1/ai/tasks/${taskId}/suggest-subtasks`, {}),
      );
    } finally {
      this.loading.suggestSubtasks.set(false);
    }
  }

  async summary(_taskId: string, commentIds: string[] = []): Promise<unknown> {
    // Backend exposes `comments/summary` with body `{ commentIds }`. taskId is
    // kept in the signature so existing callers don't break; pass commentIds
    // when available.
    this.loading.summary.set(true);
    try {
      return await firstValueFrom(
        this.http.post('/api/v1/ai/comments/summary', { commentIds }),
      );
    } finally {
      this.loading.summary.set(false);
    }
  }
}
