import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Area = workspace-scoped department/team. Used to tag employees and projects
 * so the UI can colour-band them across the directory, organigrama and project
 * lists. Backed by the `areas` table on the backend; soft-deleted areas null
 * out `users.areaId` and `projects.areaId` transactionally.
 */
export interface Area {
  id: string;
  workspaceId: string;
  name: string;
  /** Hex color (e.g. `#7c3aed`). Default chosen server-side. */
  color: string;
  /**
   * Either a primeicon name like `pi-briefcase` OR a short emoji like
   * `🏢`. Renderers should detect the `pi-` prefix and emit an `<i>` tag
   * accordingly; otherwise render the string as text/emoji.
   */
  icon: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateAreaBody {
  name: string;
  color?: string;
  icon?: string | null;
  description?: string | null;
}

export interface UpdateAreaBody {
  name?: string;
  color?: string;
  icon?: string | null;
  description?: string | null;
}

/**
 * Thin client over the workspace-scoped area endpoints. Mirrors the
 * Promise-based style used by `EmployeeApiService` and `OrgGraphApiService`
 * so callers can simply `await` results.
 */
@Injectable({ providedIn: 'root' })
export class AreaApiService {
  private readonly http = inject(HttpClient);

  list(workspaceId: string): Promise<Area[]> {
    return firstValueFrom(
      this.http.get<Area[]>(`/api/v1/workspaces/${workspaceId}/areas`),
    );
  }

  create(workspaceId: string, dto: CreateAreaBody): Promise<Area> {
    return firstValueFrom(
      this.http.post<Area>(`/api/v1/workspaces/${workspaceId}/areas`, dto),
    );
  }

  update(
    workspaceId: string,
    id: string,
    dto: UpdateAreaBody,
  ): Promise<Area> {
    return firstValueFrom(
      this.http.patch<Area>(
        `/api/v1/workspaces/${workspaceId}/areas/${id}`,
        dto,
      ),
    );
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`/api/v1/workspaces/${workspaceId}/areas/${id}`),
    );
  }
}
