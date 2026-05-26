import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CommandProvider } from '../command-palette.service';
import type { CommandResult } from '../recent-items.helper';

@Injectable({ providedIn: 'root' })
export class AiActionProvider implements CommandProvider {
  private readonly router = inject(Router);

  async search(_query: string): Promise<CommandResult[]> {
    const results: CommandResult[] = [];

    // Contextual — only show when on a task route
    const taskMatch = /\/tasks\/([^/]+)/.exec(this.router.url);
    if (taskMatch) {
      const taskId = taskMatch[1];
      results.push({
        id: `ai:describe:${taskId}`,
        label: 'Describe current task with AI',
        type: 'ai' as const,
        description: 'Generate a description for this task using AI',
        action: () => {
          // Trigger AI describe — handled by task detail component listening for router state
          this.router.navigate([], {
            queryParams: { aiAction: 'describe' },
            queryParamsHandling: 'merge',
          });
        },
      });
      results.push({
        id: `ai:subtasks:${taskId}`,
        label: 'Suggest subtasks with AI',
        type: 'ai' as const,
        description: 'Get AI-generated subtask suggestions',
        action: () => {
          this.router.navigate([], {
            queryParams: { aiAction: 'subtasks' },
            queryParamsHandling: 'merge',
          });
        },
      });
    }

    return results;
  }
}
