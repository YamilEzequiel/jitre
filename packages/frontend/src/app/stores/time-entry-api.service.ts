import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface TimeEntry {
  id: string;
  workspaceId: string;
  taskId: string;
  userId: string;
  durationMinutes: number;
  date: string;
  description: string | null;
  billable: boolean;
  startedAt: string | null;
  stoppedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimeEntryBody {
  taskId: string;
  durationMinutes: number;
  date: string;
  description?: string | null;
  billable?: boolean;
}

export interface UpdateTimeEntryBody {
  durationMinutes?: number;
  date?: string;
  description?: string | null;
  billable?: boolean;
}

export interface TimeEntryListFilters {
  userId?: string;
  taskId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  billable?: boolean;
}

export type TimeReportGroupBy = 'user' | 'project' | 'task' | 'date';

export interface TimeReportQuery {
  groupBy: TimeReportGroupBy;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  projectId?: string;
}

export interface TimeReportRow {
  groupKey: string;
  totalMinutes: number;
  entryCount: number;
}

export interface StartTimerBody {
  taskId: string;
  description?: string | null;
  billable?: boolean;
}

export interface TaskTimeSummary {
  totalMinutes: number;
  entries: TimeEntry[];
}

@Injectable({ providedIn: 'root' })
export class TimeEntryApiService {
  private readonly http = inject(HttpClient);

  create(body: CreateTimeEntryBody): Promise<TimeEntry> {
    return firstValueFrom(this.http.post<TimeEntry>('/api/v1/time-entries', body));
  }

  update(id: string, patch: UpdateTimeEntryBody): Promise<TimeEntry> {
    return firstValueFrom(this.http.patch<TimeEntry>(`/api/v1/time-entries/${id}`, patch));
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/v1/time-entries/${id}`));
  }

  getById(id: string): Promise<TimeEntry> {
    return firstValueFrom(this.http.get<TimeEntry>(`/api/v1/time-entries/${id}`));
  }

  list(filters?: TimeEntryListFilters): Promise<TimeEntry[]> {
    let params = new HttpParams();
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, String(value));
        }
      }
    }
    return firstValueFrom(this.http.get<TimeEntry[]>('/api/v1/time-entries', { params }));
  }

  startTimer(body: StartTimerBody): Promise<TimeEntry> {
    return firstValueFrom(
      this.http.post<TimeEntry>('/api/v1/time-entries/timer/start', body),
    );
  }

  stopTimer(): Promise<TimeEntry> {
    return firstValueFrom(this.http.post<TimeEntry>('/api/v1/time-entries/timer/stop', {}));
  }

  getActiveTimer(): Promise<TimeEntry | null> {
    return firstValueFrom(this.http.get<TimeEntry | null>('/api/v1/time-entries/timer/active'));
  }

  report(query: TimeReportQuery): Promise<TimeReportRow[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return firstValueFrom(
      this.http.get<TimeReportRow[]>('/api/v1/time-entries/report', { params }),
    );
  }

  getTaskSummary(taskId: string): Promise<TaskTimeSummary> {
    return firstValueFrom(
      this.http.get<TaskTimeSummary>(`/api/v1/tasks/${taskId}/time-summary`),
    );
  }
}
