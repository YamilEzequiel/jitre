import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AiPrioritySuggestion {
  id: string;
  workspaceId: string;
  taskId: string;
  currentPriority: string;
  suggestedPriority: string;
  reason: string;
  status: 'open' | 'accepted' | 'dismissed' | 'stale';
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AiPrioritySuggestionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/ai/priority-suggestions';

  list(): Promise<AiPrioritySuggestion[]> {
    return firstValueFrom(this.http.get<AiPrioritySuggestion[]>(this.base));
  }

  listForTask(taskId: string): Promise<AiPrioritySuggestion[]> {
    return firstValueFrom(
      this.http.get<AiPrioritySuggestion[]>(`${this.base}/task/${taskId}`),
    );
  }

  accept(id: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/accept`, {}));
  }

  dismiss(id: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/dismiss`, {}));
  }

  regenerate(): Promise<{ created: number; stale: number }> {
    return firstValueFrom(
      this.http.post<{ created: number; stale: number }>(`${this.base}/regenerate`, {}),
    );
  }
}
