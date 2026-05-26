import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type AttachmentContext =
  | 'task'
  | 'comment'
  | 'project'
  | 'workspace'
  | 'workspace_avatar'
  | 'user_avatar';

export interface AttachmentDto {
  id: string;
  workspaceId: string;
  context: AttachmentContext;
  contextId: string | null;
  uploadedByUserId: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  createdAt: string;
  /** Present when returned by the list-by-context endpoint. */
  signedUrl?: string;
}

export interface DownloadResult {
  driver: string;
  attachment: AttachmentDto;
  signedUrl: string;
}

@Injectable({ providedIn: 'root' })
export class AttachmentApiService {
  private readonly http = inject(HttpClient);

  list(query: { context: AttachmentContext; contextId: string }): Promise<AttachmentDto[]> {
    const params = new HttpParams()
      .set('context', query.context)
      .set('contextId', query.contextId);
    return firstValueFrom(
      this.http.get<AttachmentDto[]>('/api/v1/attachments', { params }),
    );
  }

  upload(input: {
    file: File;
    context: AttachmentContext;
    contextId?: string;
  }): Promise<AttachmentDto> {
    const form = new FormData();
    form.append('file', input.file);
    form.append('context', input.context);
    if (input.contextId) form.append('contextId', input.contextId);
    return firstValueFrom(
      this.http.post<AttachmentDto>('/api/v1/attachments', form),
    );
  }

  download(id: string): Promise<DownloadResult> {
    return firstValueFrom(
      this.http.get<DownloadResult>(`/api/v1/attachments/${id}/download`),
    );
  }

  /** Upload an image and return the signed URL ready to embed in <img src>. */
  async uploadImage(input: {
    file: File;
    context: AttachmentContext;
    contextId?: string;
  }): Promise<{ id: string; url: string }> {
    const att = await this.upload(input);
    const dl = await this.download(att.id);
    return { id: att.id, url: dl.signedUrl };
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/v1/attachments/${id}`));
  }
}
