import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type CommentContext = 'task' | 'project';

/** Raw comment as returned by the backend. */
export interface CommentDto {
  id: string;
  workspaceId: string;
  contextType: CommentContext;
  contextId: string;
  authorUserId: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface PaginatedComments {
  data: CommentDto[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCommentBody {
  contextType: CommentContext;
  contextId: string;
  body: string;
  parentId?: string;
}

@Injectable({ providedIn: 'root' })
export class CommentApiService {
  private readonly http = inject(HttpClient);

  async list(query: { contextType: CommentContext; contextId: string; page?: number; limit?: number }): Promise<CommentDto[]> {
    let params = new HttpParams()
      .set('contextType', query.contextType)
      .set('contextId', query.contextId);
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));
    const res = await firstValueFrom(
      this.http.get<PaginatedComments>('/api/v1/comments', { params }),
    );
    return res.data ?? [];
  }

  create(body: CreateCommentBody): Promise<CommentDto> {
    return firstValueFrom(this.http.post<CommentDto>('/api/v1/comments', body));
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/v1/comments/${id}`));
  }

  update(id: string, body: string): Promise<CommentDto> {
    return firstValueFrom(this.http.patch<CommentDto>(`/api/v1/comments/${id}`, { body }));
  }
}
