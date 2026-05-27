import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';

interface NotificationPrefs {
  in_app: boolean;
  email: boolean;
  task_assigned: boolean;
  task_due_soon: boolean;
  task_completed: boolean;
  task_status_changed: boolean;
  project_member_added: boolean;
  ai_quota_warning: boolean;
}

interface MySettingsResponse {
  notifications: NotificationPrefs & { batching_window_minutes: number };
}

@Component({
  selector: 'jt-notification-settings-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7
             shadow-sm shadow-slate-200/70"
    >
      <h2 class="text-xl font-bold tracking-tight text-slate-950 mb-6">Notifications</h2>
      @if (prefs()) {
        <div class="space-y-2 max-w-md">
          @for (pref of prefKeys; track pref.key) {
            <label
              class="flex items-center gap-3 cursor-pointer rounded-lg
                     border border-slate-200 bg-white backdrop-blur-sm
                     px-4 py-3 hover:bg-violet-50 hover:border-violet-200 transition-colors"
            >
              <input
                type="checkbox"
                [checked]="prefs()![pref.key]"
                (change)="toggle(pref.key)"
              />
              <span class="text-sm text-slate-700">{{ pref.label }}</span>
            </label>
          }
        </div>
      } @else {
        <p class="text-sm text-slate-500">Loading preferences...</p>
      }
    </section>
  `,
})
export class NotificationSettingsPanelComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  readonly prefs = signal<NotificationPrefs | null>(null);

  readonly prefKeys: { key: keyof NotificationPrefs; label: string }[] = [
    { key: 'in_app', label: 'In-app notifications' },
    { key: 'email', label: 'Email notifications' },
    { key: 'task_assigned', label: 'Task assigned to me' },
    { key: 'task_due_soon', label: 'Task due soon' },
    { key: 'task_completed', label: 'Task completed' },
    { key: 'task_status_changed', label: 'Task status changed' },
    { key: 'project_member_added', label: 'Project member added' },
    { key: 'ai_quota_warning', label: 'AI quota warning' },
  ];

  ngOnInit(): void {
    firstValueFrom(this.http.get<MySettingsResponse>('/api/v1/settings/me'))
      .then(settings => this.prefs.set(settings.notifications))
      .catch(() => this.toast.error('Failed to load preferences'));
  }

  toggle(key: keyof NotificationPrefs): void {
    const previous = this.prefs()?.[key];
    if (previous === undefined) return;

    this.prefs.update(prefs => prefs ? { ...prefs, [key]: !prefs[key] } : prefs);
    const updated = this.prefs();
    if (!updated) return;

    firstValueFrom(
      this.http.patch('/api/v1/settings/me', {
        key: `notification.${key}`,
        value: updated[key],
      }),
    ).catch(() => {
      this.prefs.update(prefs => prefs ? { ...prefs, [key]: previous } : prefs);
      this.toast.error('Failed to save preference');
    });
  }
}
