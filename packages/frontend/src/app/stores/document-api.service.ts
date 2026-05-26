import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Document {
  id: string;
  workspaceId: string;
  projectId: string | null;
  parentId: string | null;
  title: string;
  icon: string | null;
  content: Record<string, unknown>;
  contentText: string;
  order: number;
  creatorUserId: string;
  lastEditedByUserId: string;
  lastEditedAt: string | null;
  createdAt: string;
  updatedAt: string;
  children?: Document[];
}

export interface DocumentCreateBody {
  title: string;
  projectId?: string | null;
  parentId?: string | null;
  content?: Record<string, unknown>;
  icon?: string | null;
  order?: number;
}

export interface DocumentUpdateBody {
  title?: string;
  content?: Record<string, unknown>;
  icon?: string | null;
  order?: number;
}

export interface DocumentMoveBody {
  parentId?: string | null;
  order?: number;
}

export interface DocumentListFilters {
  parentId?: string | null;
  projectId?: string;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentApiService {
  private readonly http = inject(HttpClient);

  tree(projectId?: string): Promise<Document[]> {
    let params = new HttpParams();
    if (projectId) params = params.set('projectId', projectId);
    return firstValueFrom(this.http.get<Document[]>('/api/v1/documents/tree', { params }));
  }

  list(filters: DocumentListFilters = {}): Promise<Document[]> {
    let params = new HttpParams();
    if (filters.parentId !== undefined) {
      params = params.set('parentId', filters.parentId === null ? 'null' : filters.parentId);
    }
    if (filters.projectId) params = params.set('projectId', filters.projectId);
    if (filters.q) params = params.set('q', filters.q);
    return firstValueFrom(this.http.get<Document[]>('/api/v1/documents', { params }));
  }

  getById(id: string): Promise<Document> {
    return firstValueFrom(this.http.get<Document>(`/api/v1/documents/${id}`));
  }

  create(body: DocumentCreateBody): Promise<Document> {
    return firstValueFrom(this.http.post<Document>('/api/v1/documents', body));
  }

  update(id: string, patch: DocumentUpdateBody): Promise<Document> {
    return firstValueFrom(this.http.patch<Document>(`/api/v1/documents/${id}`, patch));
  }

  move(id: string, body: DocumentMoveBody): Promise<Document> {
    return firstValueFrom(this.http.patch<Document>(`/api/v1/documents/${id}/move`, body));
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/v1/documents/${id}`));
  }
}
