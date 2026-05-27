import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AiDailyDigest {
  id: string;
  workspaceId: string;
  digestDate: string;
  summary: string;
  tasksCreated: number;
  tasksCompleted: number;
  commentsPosted: number;
  timeLoggedMinutes: number;
  model: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AiDailyDigestApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/ai/daily-digest';

  latest(): Promise<AiDailyDigest | null> {
    return firstValueFrom(this.http.get<AiDailyDigest | null>(`${this.base}/latest`));
  }

  list(limit = 7): Promise<AiDailyDigest[]> {
    const params = new HttpParams().set('limit', String(limit));
    return firstValueFrom(this.http.get<AiDailyDigest[]>(this.base, { params }));
  }

  byDate(date: string): Promise<AiDailyDigest | null> {
    return firstValueFrom(this.http.get<AiDailyDigest | null>(`${this.base}/${date}`));
  }

  regenerate(): Promise<AiDailyDigest> {
    return firstValueFrom(this.http.post<AiDailyDigest>(`${this.base}/regenerate`, {}));
  }
}
