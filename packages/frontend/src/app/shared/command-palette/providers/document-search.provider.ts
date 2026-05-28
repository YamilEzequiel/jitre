import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { CommandProvider } from '../command-palette.service';
import type { CommandResult } from '../recent-items.helper';

interface SearchHit {
  entityType: 'document';
  entityId: string;
  workspaceId: string;
  rank: number;
  snippet: string;
  occurredAt: string;
}

interface SearchResponse {
  items: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class DocumentSearchProvider implements CommandProvider {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  async search(query: string): Promise<CommandResult[]> {
    const res = await firstValueFrom(
      this.http.get<SearchResponse>('/api/v1/search', {
        params: { type: 'document', q: query },
      }),
    );
    return (res.items ?? []).map(h => ({
      id: h.entityId,
      label: stripHighlights(h.snippet) || 'Document',
      type: 'document' as const,
      description: h.snippet,
      action: () => this.router.navigate(['/docs', h.entityId]),
    }));
  }
}

function stripHighlights(snippet: string): string {
  return snippet.replace(/<\/?b>/g, '').trim();
}
