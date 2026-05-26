import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type ProjectRole = 'viewer' | 'contributor' | 'admin';

/**
 * Safe member summary returned by `GET /api/v1/projects/:id/members`.
 * It contains display identity for project-member UI without exposing raw user entities.
 */
export interface ProjectMember {
  id: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  assignedAt: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProjectMemberApiService {
  private readonly http = inject(HttpClient);

  listByProject(projectId: string): Promise<ProjectMember[]> {
    return firstValueFrom(
      this.http.get<ProjectMember[]>(`/api/v1/projects/${projectId}/members`),
    );
  }
}
