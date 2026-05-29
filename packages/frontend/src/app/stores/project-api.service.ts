import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Project = workspace-scoped board with optional metadata for stack /
 * customer / area attribution. The metadata fields are all optional and
 * arrive directly from the backend `projects` table.
 */
export interface Project {
  id: string;
  name: string;
  key: string;
  status: 'active' | 'archived';
  workspaceId: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  /** Optional reference to a workspace `Area`. */
  areaId?: string | null;
  /** Free-text classifier (e.g. "Producto interno", "Outsourcing"). */
  category?: string | null;
  /** Primary framework / runtime (e.g. "Angular 21", "NestJS 11"). */
  framework?: string | null;
  /** Primary database engine (e.g. "PostgreSQL 16"). */
  database?: string | null;
  /**
   * Optional reference to a workspace `Customer`. Replaces the legacy
   * free-text `customerName` field.
   */
  customerId?: string | null;
  /** URL to the source repository — `https://...` or `git@...`. */
  repositoryUrl?: string | null;
}

export interface CreateProjectBody {
  name: string;
  key: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  areaId?: string | null;
  category?: string | null;
  framework?: string | null;
  database?: string | null;
  customerId?: string | null;
  repositoryUrl?: string | null;
}

export interface UpdateProjectBody {
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  areaId?: string | null;
  category?: string | null;
  framework?: string | null;
  database?: string | null;
  customerId?: string | null;
  repositoryUrl?: string | null;
  status?: 'active' | 'archived';
}

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly http = inject(HttpClient);

  getById(id: string): Promise<Project> {
    return firstValueFrom(this.http.get<Project>(`/api/v1/projects/${id}`));
  }

  list(_workspaceId: string): Promise<Project[]> {
    // Backend takes workspace from x-workspace-id header (tenancy interceptor).
    return firstValueFrom(this.http.get<Project[]>('/api/v1/projects'));
  }

  create(_workspaceId: string, body: CreateProjectBody): Promise<Project> {
    return firstValueFrom(this.http.post<Project>('/api/v1/projects', body));
  }

  update(id: string, body: UpdateProjectBody): Promise<Project> {
    return firstValueFrom(
      this.http.patch<Project>(`/api/v1/projects/${id}`, body),
    );
  }
}
