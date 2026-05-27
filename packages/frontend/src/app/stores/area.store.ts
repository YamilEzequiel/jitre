import { Injectable, computed, inject, signal } from '@angular/core';
import { Area, AreaApiService } from './area-api.service';

/**
 * Workspace-scoped signal cache for areas. Multiple features (employees,
 * organigrama, projects) need the same list — funnel through this store so
 * we hit the backend once and let computed signals propagate changes.
 *
 * Reset on workspace switch the same way other stores do.
 */
@Injectable({ providedIn: 'root' })
export class AreaStore {
  private readonly api = inject(AreaApiService);

  readonly areas = signal<Area[]>([]);
  readonly loading = signal(false);

  readonly byId = computed<Record<string, Area>>(() => {
    const map: Record<string, Area> = {};
    for (const a of this.areas()) map[a.id] = a;
    return map;
  });

  /**
   * Loads the area list for a workspace. Safe to call repeatedly — the second
   * caller pays the network cost but the cache stays consistent.
   */
  async load(workspaceId: string): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.api.list(workspaceId);
      this.areas.set(list);
    } finally {
      this.loading.set(false);
    }
  }

  /** Replaces the entry with the same id, or appends if it's new. */
  upsert(area: Area): void {
    this.areas.update((list) => {
      const idx = list.findIndex((a) => a.id === area.id);
      if (idx === -1) return [...list, area];
      const next = list.slice();
      next[idx] = area;
      return next;
    });
  }

  remove(id: string): void {
    this.areas.update((list) => list.filter((a) => a.id !== id));
  }

  clear(): void {
    this.areas.set([]);
  }
}
