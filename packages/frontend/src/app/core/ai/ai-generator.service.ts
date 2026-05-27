import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  AiGenerateCommitRequest,
  AiGenerateCommitResponse,
  AiGenerateDraftRequest,
  AiGenerateDraftResponse,
  AiGeneratorDraft,
} from '@jitre/shared';

/**
 * Thin HTTP wrapper around the `/ai/generate/*` endpoints.
 *
 * State (open/close, current draft) lives in `AiCreateService` so the API
 * service stays focused on the wire contract and can be reused from elsewhere
 * (e.g. a future "generate from selected task" entry point).
 */
@Injectable({ providedIn: 'root' })
export class AiGeneratorApiService {
  private readonly http = inject(HttpClient);

  draft(body: AiGenerateDraftRequest): Promise<AiGenerateDraftResponse> {
    return firstValueFrom(
      this.http.post<AiGenerateDraftResponse>('/api/v1/ai/generate/draft', body),
    );
  }

  commit(draft: AiGeneratorDraft): Promise<AiGenerateCommitResponse> {
    const body: AiGenerateCommitRequest = { draft };
    return firstValueFrom(
      this.http.post<AiGenerateCommitResponse>('/api/v1/ai/generate/commit', body),
    );
  }
}
