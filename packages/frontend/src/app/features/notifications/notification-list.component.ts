import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { SlicePipe } from '@angular/common';
import { NotificationStore } from '../../stores/notification.store';
import { NotificationApiService } from '../../stores/notification-api.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'jt-notification-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlicePipe],
  template: `
    <div class="flex flex-col h-full max-w-3xl">
      <header class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70 flex items-end justify-between gap-4 mb-6">
        <div class="space-y-3">
          <div
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full
                   border border-violet-200 bg-violet-50"
          >
            <span
              class="text-[10px] font-bold uppercase tracking-[0.18em]
                     text-violet-700"
            >
              Inbox
            </span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-black tracking-tight">
            <span class="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent">
              Notifications
            </span>
          </h1>
        </div>
        @if (store.unreadCount() > 0) {
          <button
            type="button"
            (click)="markAllAsRead()"
            class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700
                   bg-white border border-slate-200 backdrop-blur-sm
                   hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                   focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                   transition-colors"
          >
            Mark all as read
          </button>
        }
      </header>

      <div class="flex-1 overflow-auto pr-1">
        <div class="space-y-3">
          @for (notification of store.items(); track notification.id) {
            <div
              [class]="
                'group flex items-start gap-3 rounded-xl border backdrop-blur-sm p-4 cursor-pointer transition-colors ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ' +
                'focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ' +
                (notification.readAt
                  ? 'bg-white border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-300'
                  : 'bg-violet-50/50 border-violet-200 hover:bg-violet-50 hover:border-violet-300 shadow-sm')
              "
              (click)="markAsRead(notification.id)"
              role="button"
              tabindex="0"
              (keydown.enter)="markAsRead(notification.id)"
              [attr.aria-label]="notification.readAt ? notification.message : 'Unread: ' + notification.message"
            >
              <span
                [class]="
                  'mt-1.5 h-2 w-2 flex-none rounded-full ' +
                  (notification.readAt
                    ? 'bg-slate-300'
                    : 'bg-gradient-to-r from-indigo-400 to-violet-400 shadow-md shadow-indigo-500/40')
                "
                aria-hidden="true"
              ></span>
              <div class="flex-1 min-w-0">
                <p [class]="'text-sm ' + (notification.readAt ? 'text-slate-600' : 'text-slate-950 font-medium')">
                  {{ notification.message }}
                </p>
                <p class="text-[11px] text-slate-400 mt-1.5">{{ notification.createdAt | slice:0:10 }}</p>
              </div>
            </div>
          } @empty {
            <div
              class="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center"
            >
              <p class="text-sm text-slate-500">No notifications.</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class NotificationListComponent {
  readonly store = inject(NotificationStore);
  private readonly api = inject(NotificationApiService);
  private readonly auth = inject(AuthService);

  async markAsRead(id: string): Promise<void> {
    await this.api.markAsRead(id);
    this.store.markAsRead(id);
  }

  async markAllAsRead(): Promise<void> {
    const workspaceId = this.auth.currentWorkspace()?.id ?? '';
    await this.api.markAllAsRead(workspaceId);
    for (const n of this.store.items()) {
      if (!n.readAt) {
        this.store.markAsRead(n.id);
      }
    }
  }
}
