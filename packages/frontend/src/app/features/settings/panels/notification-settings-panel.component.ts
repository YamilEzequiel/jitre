import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../../core/toast/toast.service';
import { CheckboxComponent } from '../../../shared/checkbox/checkbox.component';

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
  imports: [CheckboxComponent, TranslatePipe],
  template: `
    <section
      class="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7
             shadow-sm shadow-slate-200/70"
    >
      <h2 class="text-xl font-bold tracking-tight text-slate-950 mb-6">
        {{ 'settings.notifications.heading' | translate }}
      </h2>
      @if (prefs()) {
        <div class="space-y-2 max-w-md">
          @for (pref of prefKeys(); track pref.key) {
            <label
              class="flex items-center gap-3 cursor-pointer rounded-lg
                     border border-slate-200 bg-white backdrop-blur-sm
                     px-4 py-3 hover:bg-violet-50 hover:border-violet-200 transition-colors"
            >
              <jt-checkbox
                [checked]="prefs()![pref.key]"
                (checkedChange)="toggle(pref.key)"
                [ariaLabel]="pref.label"
              />
              <span class="text-sm text-slate-700">{{ pref.label }}</span>
            </label>
          }
        </div>
      } @else {
        <p class="text-sm text-slate-500">{{ 'settings.notifications.loading' | translate }}</p>
      }
    </section>
  `,
})
export class NotificationSettingsPanelComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly prefs = signal<NotificationPrefs | null>(null);

  private readonly prefKeyMap: { key: keyof NotificationPrefs; labelKey: string }[] = [
    { key: 'in_app', labelKey: 'settings.notifications.inApp' },
    { key: 'email', labelKey: 'settings.notifications.email' },
    { key: 'task_assigned', labelKey: 'settings.notifications.taskAssigned' },
    { key: 'task_due_soon', labelKey: 'settings.notifications.taskDueSoon' },
    { key: 'task_completed', labelKey: 'settings.notifications.taskCompleted' },
    { key: 'task_status_changed', labelKey: 'settings.notifications.taskStatusChanged' },
    { key: 'project_member_added', labelKey: 'settings.notifications.projectMemberAdded' },
    { key: 'ai_quota_warning', labelKey: 'settings.notifications.aiQuotaWarning' },
  ];

  readonly prefKeys = computed(() =>
    this.prefKeyMap.map(p => ({
      key: p.key,
      label: this.translate.instant(p.labelKey),
    })),
  );

  ngOnInit(): void {
    firstValueFrom(this.http.get<MySettingsResponse>('/api/v1/settings/me'))
      .then(settings => this.prefs.set(settings.notifications))
      .catch(() => this.toast.error(this.translate.instant('settings.notifications.errors.loadFailed')));
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
      this.toast.error(this.translate.instant('settings.notifications.errors.saveFailed'));
    });
  }
}
