import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Notification {
  id: string;
  message: string;
  type: string;
  readAt?: string | null;
  workspaceId: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);

  getById(id: string): Promise<Notification> {
    return firstValueFrom(this.http.get<Notification>(`/api/v1/notifications/${id}`));
  }

  list(_workspaceId: string): Promise<Notification[]> {
    return firstValueFrom(this.http.get<Notification[]>('/api/v1/notifications'));
  }

  markAsRead(id: string): Promise<Notification> {
    return firstValueFrom(this.http.patch<Notification>(`/api/v1/notifications/${id}/read`, {}));
  }

  markAllAsRead(_workspaceId: string): Promise<void> {
    // Backend reads workspace context from x-workspace-id header (tenancy interceptor),
    // not from the URL. workspaceId stays in the signature for symmetry with other store calls.
    return firstValueFrom(this.http.patch<void>('/api/v1/notifications/read-all', {}));
  }
}
