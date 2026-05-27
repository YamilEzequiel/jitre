import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type AiPromptOperation =
  | 'describe'
  | 'suggest_subtasks'
  | 'summary'
  | 'generate_draft';

export interface AiPromptTemplate {
  id: string;
  workspaceId: string;
  operation: AiPromptOperation;
  name: string;
  description: string | null;
  systemPrompt: string;
  userTemplate: string;
  variables: string[];
  isDefault: boolean;
  isBuiltin: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAiPromptTemplateBody {
  operation: AiPromptOperation;
  name: string;
  description?: string;
  systemPrompt: string;
  userTemplate: string;
  variables?: string[];
  isDefault?: boolean;
}

export type UpdateAiPromptTemplateBody = Partial<CreateAiPromptTemplateBody>;

@Injectable({ providedIn: 'root' })
export class AiPromptTemplateApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/ai-prompt-templates';

  list(operation?: AiPromptOperation): Promise<AiPromptTemplate[]> {
    let params = new HttpParams();
    if (operation) params = params.set('operation', operation);
    return firstValueFrom(this.http.get<AiPromptTemplate[]>(this.base, { params }));
  }

  getById(id: string): Promise<AiPromptTemplate> {
    return firstValueFrom(this.http.get<AiPromptTemplate>(`${this.base}/${id}`));
  }

  create(body: CreateAiPromptTemplateBody): Promise<AiPromptTemplate> {
    return firstValueFrom(this.http.post<AiPromptTemplate>(this.base, body));
  }

  update(id: string, body: UpdateAiPromptTemplateBody): Promise<AiPromptTemplate> {
    return firstValueFrom(this.http.patch<AiPromptTemplate>(`${this.base}/${id}`, body));
  }

  setDefault(id: string): Promise<AiPromptTemplate> {
    return firstValueFrom(
      this.http.post<AiPromptTemplate>(`${this.base}/${id}/set-default`, {}),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}
