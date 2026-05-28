import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { CommandProvider } from '../command-palette.service';
import type { CommandResult } from '../recent-items.helper';

interface SearchHit {
  entityType: 'comment';
  entityId: string;
  workspaceId: string;
  rank: number;
  snippet: string;
  occurredAt: string;
  parentType: 'task' | 'project' | null;
  parentId: string | null;
}

interface SearchResponse {
  items: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class CommentSearchProvider implements CommandProvider {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  async search(query: string): Promise<CommandResult[]> {
    const res = await firstValueFrom(
      this.http.get<SearchResponse>('/api/v1/search', {
        params: { type: 'comment', q: query },
      }),
    );
    return (res.items ?? []).map(h => ({
      id: h.entityId,
      label: stripHighlights(h.snippet) || 'Comment',
      type: 'comment' as const,
      description: h.snippet,
      action: () => this.navigateToParent(h),
    }));
  }

  private navigateToParent(hit: SearchHit): void {
    if (hit.parentType === 'task' && hit.parentId) {
      this.router.navigate(['/tasks', hit.parentId], {
        fragment: `comment-${hit.entityId}`,
      });
      return;
    }
    if (hit.parentType === 'project' && hit.parentId) {
      this.router.navigate(['/projects', hit.parentId], {
        fragment: `comment-${hit.entityId}`,
      });
      return;
    }
    // Orphaned comment — older search docs may have null parent until
    // they get re-indexed. Fall back to dashboard so the click does
    // something rather than silently failing.
    this.router.navigate(['/']);
  }
}

function stripHighlights(snippet: string): string {
  return snippet.replace(/<\/?b>/g, '').trim();
}
