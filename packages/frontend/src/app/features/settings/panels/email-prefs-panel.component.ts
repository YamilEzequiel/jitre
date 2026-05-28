import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../../core/toast/toast.service';
import { CheckboxComponent } from '../../../shared/checkbox/checkbox.component';

interface MeResponse {
  emailMentions?: boolean;
  emailAssignments?: boolean;
  emailDueDates?: boolean;
}

type PrefKey = 'emailMentions' | 'emailAssignments' | 'emailDueDates';

/**
 * Per-user opt-out toggles for email notifications. The notification engine
 * dispatches every in-app notification through NotificationEmailListener,
 * which consults these flags before sending. Defaults are `true` so users
 * get emails out of the box; this panel lets them dial each category down.
 */
@Component({
  selector: 'jt-email-prefs-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, TranslatePipe],
  template: `
    <section class="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm shadow-slate-200/70">
      <h2 class="text-xl font-bold tracking-tight text-slate-950 mb-1">
        {{ 'settings.email.heading' | translate }}
      </h2>
      <p class="text-sm text-slate-500 mb-6">{{ 'settings.email.description' | translate }}</p>

      @if (loaded()) {
        <div class="space-y-2 max-w-md">
          @for (pref of prefKeys(); track pref.key) {
            <label class="flex items-center gap-3 cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-violet-50 hover:border-violet-200 transition-colors">
              <jt-checkbox
                [checked]="value(pref.key)"
                (checkedChange)="toggle(pref.key)"
                [ariaLabel]="pref.label"
              />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-slate-800">{{ pref.label }}</p>
                <p class="text-xs text-slate-500">{{ pref.help }}</p>
              </div>
            </label>
          }
        </div>
      } @else {
        <p class="text-sm text-slate-500">{{ 'settings.email.loading' | translate }}</p>
      }
    </section>
  `,
})
export class EmailPrefsPanelComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly loaded = signal(false);
  readonly emailMentions = signal(true);
  readonly emailAssignments = signal(true);
  readonly emailDueDates = signal(true);

  private readonly prefKeyMap: { key: PrefKey; labelKey: string; helpKey: string }[] = [
    {
      key: 'emailMentions',
      labelKey: 'settings.email.mentions.label',
      helpKey: 'settings.email.mentions.help',
    },
    {
      key: 'emailAssignments',
      labelKey: 'settings.email.assignments.label',
      helpKey: 'settings.email.assignments.help',
    },
    {
      key: 'emailDueDates',
      labelKey: 'settings.email.dueDates.label',
      helpKey: 'settings.email.dueDates.help',
    },
  ];

  readonly prefKeys = computed(() =>
    this.prefKeyMap.map(p => ({
      key: p.key,
      label: this.translate.instant(p.labelKey),
      help: this.translate.instant(p.helpKey),
    })),
  );

  async ngOnInit(): Promise<void> {
    try {
      const me = await firstValueFrom(this.http.get<MeResponse>('/api/v1/users/me'));
      this.emailMentions.set(me.emailMentions !== false);
      this.emailAssignments.set(me.emailAssignments !== false);
      this.emailDueDates.set(me.emailDueDates !== false);
    } catch {
      this.toast.error(this.translate.instant('settings.email.errors.loadFailed'));
    } finally {
      this.loaded.set(true);
    }
  }

  value(key: PrefKey): boolean {
    if (key === 'emailMentions') return this.emailMentions();
    if (key === 'emailAssignments') return this.emailAssignments();
    return this.emailDueDates();
  }

  async toggle(key: PrefKey): Promise<void> {
    const prev = this.value(key);
    const next = !prev;
    this.set(key, next);
    try {
      await firstValueFrom(this.http.patch('/api/v1/users/me', { [key]: next }));
    } catch {
      this.set(key, prev);
      this.toast.error(this.translate.instant('settings.email.errors.saveFailed'));
    }
  }

  private set(key: PrefKey, v: boolean): void {
    if (key === 'emailMentions') this.emailMentions.set(v);
    else if (key === 'emailAssignments') this.emailAssignments.set(v);
    else this.emailDueDates.set(v);
  }
}
