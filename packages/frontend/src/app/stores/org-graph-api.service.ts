import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Org-graph DTOs — mirror the backend exactly. Roles arrive as the literal
 * strings the backend serialises (lowercase). `jobTitle` is mapped server-side
 * from `UserEntity.position`.
 */
export interface OrgGraphNode {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  role: 'owner' | 'admin' | 'member';
}

export interface OrgGraphEdge {
  /** Subordinate user id. */
  from: string;
  /** Supervisor user id. */
  to: string;
}

export interface OrgGraph {
  nodes: OrgGraphNode[];
  edges: OrgGraphEdge[];
}

/**
 * Thin client over the workspace-scoped org-graph endpoints. Matches the
 * Promise-returning style of `EmployeeApiService` so callers can simply
 * `await` results.
 */
@Injectable({ providedIn: 'root' })
export class OrgGraphApiService {
  private readonly http = inject(HttpClient);

  getOrgGraph(workspaceId: string): Promise<OrgGraph> {
    return firstValueFrom(
      this.http.get<OrgGraph>(
        `/api/v1/workspaces/${workspaceId}/org-graph`,
      ),
    );
  }

  async addReport(
    workspaceId: string,
    userId: string,
    supervisorId: string,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `/api/v1/workspaces/${workspaceId}/reports`,
        { userId, supervisorId },
      ),
    );
  }

  async removeReport(
    workspaceId: string,
    userId: string,
    supervisorId: string,
  ): Promise<void> {
    await firstValueFrom(
      this.http.delete(
        `/api/v1/workspaces/${workspaceId}/reports/${userId}/supervisor/${supervisorId}`,
      ),
    );
  }
}
