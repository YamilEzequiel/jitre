import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type AutomationTrigger =
  | 'task.created'
  | 'task.status_changed'
  | 'task.assigned'
  | 'task.priority_changed'
  | 'task.due_soon';

export type AutomationActionType =
  | 'assign_to_user'
  | 'set_priority'
  | 'set_status'
  | 'add_label'
  | 'add_comment'
  | 'notify_user';

export interface AutomationCondition {
  field: string;
  op: 'eq' | 'neq' | 'in' | 'not_in' | 'changed_to' | 'changed_from';
  value: unknown;
}

export interface AutomationAction {
  type: AutomationActionType;
  params: Record<string, unknown>;
}

export interface Automation {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger: AutomationTrigger;
  triggerConfig: Record<string, unknown> | null;
  conditions: AutomationCondition[] | null;
  actions: AutomationAction[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationBody {
  name: string;
  description?: string | null;
  trigger: AutomationTrigger;
  triggerConfig?: Record<string, unknown> | null;
  conditions?: AutomationCondition[] | null;
  actions: AutomationAction[];
  enabled?: boolean;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  triggeredAt: string;
  status: 'success' | 'error' | 'skipped';
  context: Record<string, unknown> | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class AutomationApiService {
  private readonly http = inject(HttpClient);

  list(projectId: string): Promise<Automation[]> {
    return firstValueFrom(
      this.http.get<Automation[]>(`/api/v1/projects/${projectId}/automations`),
    );
  }

  create(projectId: string, body: CreateAutomationBody): Promise<Automation> {
    return firstValueFrom(
      this.http.post<Automation>(`/api/v1/projects/${projectId}/automations`, body),
    );
  }

  update(
    projectId: string,
    id: string,
    body: Partial<CreateAutomationBody>,
  ): Promise<Automation> {
    return firstValueFrom(
      this.http.patch<Automation>(
        `/api/v1/projects/${projectId}/automations/${id}`,
        body,
      ),
    );
  }

  remove(projectId: string, id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`/api/v1/projects/${projectId}/automations/${id}`),
    );
  }

  runs(projectId: string, id: string): Promise<AutomationRun[]> {
    return firstValueFrom(
      this.http.get<AutomationRun[]>(
        `/api/v1/projects/${projectId}/automations/${id}/runs`,
      ),
    );
  }
}
