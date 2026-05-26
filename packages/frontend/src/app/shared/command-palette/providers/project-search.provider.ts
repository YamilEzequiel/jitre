import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { CommandProvider } from '../command-palette.service';
import type { CommandResult } from '../recent-items.helper';

interface ProjectSearchResult {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectSearchProvider implements CommandProvider {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  async search(query: string): Promise<CommandResult[]> {
    const results = await firstValueFrom(
      this.http.get<ProjectSearchResult[]>('/api/v1/search', {
        params: { type: 'project', q: query },
      }),
    );
    return results.map(p => ({
      id: p.id,
      label: p.name,
      type: 'project' as const,
      action: () => this.router.navigate(['/projects', p.id]),
    }));
  }
}
