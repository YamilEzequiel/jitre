import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type PlanningItemType = 'epic' | 'sprint' | 'release';

export interface PlanningItem {
  id: string;
  projectId: string;
  workspaceId: string;
  type: PlanningItemType;
  name: string;
  goal?: string | null;
  status: string;
  color?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface CreatePlanningItemBody {
  type: PlanningItemType;
  name: string;
  goal?: string | null;
  status?: string;
  color?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PlanningApiService {
  private readonly http = inject(HttpClient);

  list(projectId: string, type?: PlanningItemType): Promise<PlanningItem[]> {
    const params = type ? new HttpParams().set('type', type) : undefined;
    return firstValueFrom(
      this.http.get<PlanningItem[]>(`/api/v1/projects/${projectId}/planning`, { params }),
    );
  }

  create(projectId: string, body: CreatePlanningItemBody): Promise<PlanningItem> {
    return firstValueFrom(
      this.http.post<PlanningItem>(`/api/v1/projects/${projectId}/planning`, body),
    );
  }

  update(projectId: string, id: string, patch: Partial<CreatePlanningItemBody>): Promise<PlanningItem> {
    return firstValueFrom(
      this.http.patch<PlanningItem>(`/api/v1/projects/${projectId}/planning/${id}`, patch),
    );
  }

  delete(projectId: string, id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`/api/v1/projects/${projectId}/planning/${id}`),
    );
  }
}
