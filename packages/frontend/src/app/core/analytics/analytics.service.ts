import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface DateRange {
  from: string;
  to: string;
}

export interface AnalyticsPeriodPoint {
  period: string;
  value: number;
}

export interface WorkloadBucket {
  key: string;
  count: number;
}

export interface AiUsagePoint {
  period: string;
  requests: number;
  costUsd: string;
  totalTokens: number;
}

export type WorkloadGroupBy = 'assignee' | 'status';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);

  private workspacePeriodGet<T>(endpoint: string, from: string, to: string): Promise<T> {
    const params = new HttpParams()
      .set('from', from)
      .set('to', to)
      .set('period', 'day');
    return firstValueFrom(
      this.http.get<T>(`/api/v1/analytics/workspace/${endpoint}`, { params }),
    );
  }

  getVelocity(from: string, to: string): Promise<AnalyticsPeriodPoint[]> {
    return this.workspacePeriodGet<AnalyticsPeriodPoint[]>('velocity', from, to);
  }

  getThroughput(from: string, to: string): Promise<AnalyticsPeriodPoint[]> {
    return this.workspacePeriodGet<AnalyticsPeriodPoint[]>('throughput', from, to);
  }

  getWorkload(groupBy: WorkloadGroupBy = 'assignee', projectId?: string): Promise<WorkloadBucket[]> {
    let params = new HttpParams().set('groupBy', groupBy);
    if (projectId) params = params.set('projectId', projectId);
    return firstValueFrom(
      this.http.get<WorkloadBucket[]>('/api/v1/analytics/workspace/workload', { params }),
    );
  }

  getAiUsage(from: string, to: string): Promise<unknown> {
    return this.workspacePeriodGet<AiUsagePoint[]>('ai-usage', from, to);
  }

  getAiUsageByUser(from: string, to: string): Promise<unknown> {
    return this.workspacePeriodGet('ai-usage/by-user', from, to);
  }

  getAiUsageByOperation(from: string, to: string): Promise<unknown> {
    return this.workspacePeriodGet('ai-usage/by-operation', from, to);
  }

  getAiFailureRate(from: string, to: string): Promise<unknown> {
    return this.workspacePeriodGet('ai-usage/failure-rate', from, to);
  }

  private projectPeriodGet<T>(projectId: string, endpoint: string, from: string, to: string): Promise<T> {
    const params = new HttpParams()
      .set('from', from)
      .set('to', to)
      .set('period', 'day');
    return firstValueFrom(
      this.http.get<T>(`/api/v1/analytics/projects/${projectId}/${endpoint}`, { params }),
    );
  }

  getProjectVelocity(projectId: string, from: string, to: string): Promise<AnalyticsPeriodPoint[]> {
    return this.projectPeriodGet<AnalyticsPeriodPoint[]>(projectId, 'velocity', from, to);
  }

  getProjectBurndown(projectId: string, from: string, to: string): Promise<AnalyticsPeriodPoint[]> {
    const params = new HttpParams().set('from', from).set('to', to).set('endOfDay', 'true');
    return firstValueFrom(
      this.http.get<AnalyticsPeriodPoint[]>(`/api/v1/analytics/projects/${projectId}/burndown`, { params }),
    );
  }

  getProjectLeadTime(projectId: string, from: string, to: string): Promise<unknown[]> {
    return this.projectPeriodGet<unknown[]>(projectId, 'lead-time', from, to);
  }

  getProjectCycleTime(projectId: string, from: string, to: string): Promise<unknown[]> {
    return this.projectPeriodGet<unknown[]>(projectId, 'cycle-time', from, to);
  }

  getProjectStatusFlow(projectId: string, from: string, to: string): Promise<unknown[]> {
    return this.projectPeriodGet<unknown[]>(projectId, 'status-flow', from, to);
  }
  getWorkspaceStats(): Promise<unknown> {
    return firstValueFrom(this.http.get('/api/v1/analytics/workspace-stats'));
  }

  /** Returns UTC ISO strings for a date range ending now spanning the last N days */
  lastNDays(n: number): DateRange {
    const to = new Date();
    const from = new Date(to.getTime() - n * 24 * 60 * 60 * 1000);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }
}
