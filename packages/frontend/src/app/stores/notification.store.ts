import { Injectable, computed, inject } from '@angular/core';
import { createEntityStore } from './entity-store.factory';
import { NotificationApiService, Notification } from './notification-api.service';

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly api = inject(NotificationApiService);
  private readonly store = createEntityStore<Notification>();

  readonly items = this.store.items;
  readonly byId = this.store.byId;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly unreadCount = computed(() => this.items().filter(n => !n.readAt).length);

  constructor() {
    this.store.setRefetcher(id => this.api.getById(id));
  }

  load(notifications: Notification[]): void {
    this.store.load(notifications);
  }

  clear(): void {
    this.store.clear();
  }

  applyEvent(event: { type: 'created' | 'updated' | 'deleted'; id: string }): Promise<void> {
    return this.store.applyEvent(event);
  }

  async markAsRead(id: string): Promise<void> {
    const updated = await this.api.markAsRead(id);
    this.store.upsert(updated);
  }

  async markAllAsRead(workspaceId: string): Promise<void> {
    await this.api.markAllAsRead(workspaceId);
    const now = new Date().toISOString();
    this.store.load(this.items().map(n => ({ ...n, readAt: n.readAt ?? now })));
  }

  async onWorkspaceSwitch(workspaceId: string): Promise<void> {
    this.store.clear();
    const notifications = await this.api.list(workspaceId);
    this.store.load(notifications);
  }
}
