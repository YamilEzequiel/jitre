import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
}

export interface CreateProjectBody {
  name: string;
  key: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
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
}
