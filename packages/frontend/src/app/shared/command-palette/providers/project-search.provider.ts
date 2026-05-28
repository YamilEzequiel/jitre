import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { CommandProvider } from '../command-palette.service';
import type { CommandResult } from '../recent-items.helper';

interface SearchHit {
  entityType: 'project';
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
export class ProjectSearchProvider implements CommandProvider {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  async search(query: string): Promise<CommandResult[]> {
    const res = await firstValueFrom(
      this.http.get<SearchResponse>('/api/v1/search', {
        params: { type: 'project', q: query },
      }),
    );
    return (res.items ?? []).map(h => ({
      id: h.entityId,
      label: stripHighlights(h.snippet) || 'Project',
      type: 'project' as const,
      description: h.snippet,
      action: () => this.router.navigate(['/projects', h.entityId]),
    }));
  }
}

function stripHighlights(snippet: string): string {
  return snippet.replace(/<\/?b>/g, '').trim();
}
