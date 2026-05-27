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
    explain: signal(false),
  };

  /**
   * Process-wide tiny cache for explain responses. Same task ID asked again
   * within 5 minutes returns the cached explanation — the popover fires on
   * hover and we don't want to bill twice for a flick of the mouse.
   */
  private readonly explainCache = new Map<string, { at: number; explanation: string }>();
  private readonly EXPLAIN_TTL_MS = 5 * 60 * 1000;

  async explainTask(taskId: string): Promise<{ explanation: string } | null> {
    const cached = this.explainCache.get(taskId);
    if (cached && Date.now() - cached.at < this.EXPLAIN_TTL_MS) {
      return { explanation: cached.explanation };
    }
    this.loading.explain.set(true);
    try {
      const res = (await firstValueFrom(
        this.http.post<{ explanation: string }>(`/api/v1/ai/tasks/${taskId}/explain`, {}),
      )) as { explanation: string };
      this.explainCache.set(taskId, { at: Date.now(), explanation: res.explanation });
      return res;
    } finally {
      this.loading.explain.set(false);
    }
  }

  async describeTask(
    taskId: string,
    options: { templateId?: string; tone?: 'formal' | 'casual' | 'technical' } = {},
  ): Promise<unknown> {
    this.loading.describe.set(true);
    try {
      const body: Record<string, unknown> = {};
      if (options.templateId) body['templateId'] = options.templateId;
      if (options.tone) body['tone'] = options.tone;
      return await firstValueFrom(
        this.http.post(`/api/v1/ai/tasks/${taskId}/describe`, body),
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
