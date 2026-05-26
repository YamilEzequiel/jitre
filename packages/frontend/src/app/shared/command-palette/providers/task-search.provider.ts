import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { CommandProvider } from '../command-palette.service';
import type { CommandResult } from '../recent-items.helper';

interface TaskSearchResult {
  id: string;
  title: string;
  projectId: string;
}

@Injectable({ providedIn: 'root' })
export class TaskSearchProvider implements CommandProvider {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  async search(query: string): Promise<CommandResult[]> {
    const results = await firstValueFrom(
      this.http.get<TaskSearchResult[]>('/api/v1/search', {
        params: { type: 'task', q: query },
      }),
    );
    return results.map(t => ({
      id: t.id,
      label: t.title,
      type: 'task' as const,
      description: `Project: ${t.projectId}`,
      action: () => this.router.navigate(['/tasks', t.id], {
        queryParams: { projectId: t.projectId },
      }),
    }));
  }
}
