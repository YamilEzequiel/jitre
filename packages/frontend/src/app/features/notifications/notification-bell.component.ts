import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationStore } from '../../stores/notification.store';

@Component({
  selector: 'jt-notification-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="openNotifications()"
      aria-label="Notifications"
      [attr.aria-describedby]="unreadCount() > 0 ? 'notif-badge' : null"
      class="relative inline-flex items-center justify-center h-9 w-9 rounded-lg
             border border-slate-200 bg-white text-slate-600
             hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
             focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
             transition-colors"
    >
      <!-- Bell icon -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>

      @if (unreadCount() > 0) {
        <span
          id="notif-badge"
          class="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                 rounded-full text-[10px] font-bold text-white
                 bg-gradient-to-br from-rose-500 to-fuchsia-600
                 shadow-md shadow-rose-500/40 ring-2 ring-slate-950"
          [attr.aria-label]="unreadCount() + ' unread notifications'"
        >
          {{ unreadCount() > 9 ? '9+' : unreadCount() }}
        </span>
      }
    </button>
  `,
})
export class NotificationBellComponent {
  private readonly notificationStore = inject(NotificationStore);
  private readonly router = inject(Router);

  readonly unreadCount = computed(() => this.notificationStore.unreadCount());

  openNotifications(): void {
    this.router.navigate(['/notifications']);
  }
}
