import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { AuthService } from '../../../core/auth/auth.service';

interface AiSettingsResponse {
  'ai.provider'?: 'GEMINI' | 'OPENAI' | 'ANTHROPIC';
  'ai.daily_budget_usd'?: number;
  'ai.enabled'?: boolean;
}

interface AiUsagePoint {
  costUsd: string;
}

@Component({
  selector: 'jt-ai-settings-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <section
      class="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7
             shadow-sm shadow-slate-200/70 space-y-7"
    >
      <h2 class="text-xl font-bold tracking-tight text-slate-950">AI &amp; Quota</h2>

      @if (spentUsd()) {
        <div
          class="rounded-xl border border-slate-200 bg-white backdrop-blur-sm p-5"
        >
          <div class="flex items-center justify-between">
            <p
              class="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500"
            >
              <span
                class="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-violet-400 animate-pulse"
                aria-hidden="true"
              ></span>
              Last 30 Days Spend
            </p>
            <p class="text-xs font-semibold text-slate-600">
              <span class="text-slate-400">USD </span>
              <span class="text-slate-950">{{ spentUsd() }}</span>
            </p>
          </div>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="save()" class="space-y-5 max-w-md" novalidate>
        <div>
          <label
            for="ai-provider"
            class="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2"
          >
            Provider
          </label>
          <select
            id="ai-provider"
            formControlName="provider"
            class="w-full rounded-lg bg-white border border-slate-200
                   px-3 py-2.5 text-sm text-slate-700 outline-none transition
                   focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="GEMINI" class="bg-white text-slate-700">Gemini</option>
          </select>
          <p class="mt-2 text-xs text-slate-500">
            Gemini is currently the available provider.
          </p>
        </div>
        <div>
          <label
            for="ai-budget"
            class="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2"
          >
            Daily Budget (USD)
          </label>
          <input
            id="ai-budget"
            type="number"
            formControlName="dailyBudget"
            min="0.01"
            class="w-full rounded-lg bg-white border border-slate-200
                   px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400
                   outline-none transition
                   focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <label class="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            formControlName="enabled"
            class="h-4 w-4 rounded border-slate-300 bg-white text-indigo-500
                   focus:ring-indigo-500/40 focus:ring-offset-0"
          />
          <span class="text-sm text-slate-700">AI features enabled</span>
        </label>
        <button
          type="submit"
          [disabled]="form.invalid || saving()"
          class="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white
                 bg-gradient-to-r from-indigo-600 to-violet-600
                 shadow-md shadow-indigo-500/25
                 hover:shadow-lg hover:shadow-indigo-500/40
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                 transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
        >
          @if (saving()) {
            <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"></path>
            </svg>
            Saving…
          } @else {
            Save AI Settings
          }
        </button>
      </form>
    </section>
  `,
})
export class AiSettingsPanelComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly analytics = inject(AnalyticsService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly saving = signal(false);
  readonly spentUsd = signal<string | null>(null);

  readonly form = this.fb.group({
    provider: ['GEMINI', Validators.required],
    dailyBudget: [5, [Validators.required, Validators.min(0.01)]],
    enabled: [false],
  });

  ngOnInit(): void {
    const range = this.analytics.lastNDays(30);
    this.analytics.getAiUsage(range.from, range.to)
      .then(raw => {
        const total = (raw as AiUsagePoint[]).reduce(
          (sum, point) => sum + Number(point.costUsd ?? 0),
          0,
        );
        this.spentUsd.set(total.toFixed(2));
      })
      .catch(() => undefined);

    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) return;

    firstValueFrom(
      this.http.get<AiSettingsResponse>('/api/v1/settings/ai', {
        params: { workspaceId },
      }),
    )
      .then(s => this.form.patchValue({
        provider: 'GEMINI',
        dailyBudget: s['ai.daily_budget_usd'] ?? 5,
        enabled: s['ai.enabled'] ?? false,
      }))
      .catch(() => undefined);
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) {
      this.toast.error('No active workspace selected');
      return;
    }
    this.saving.set(true);
    try {
      const values = this.form.getRawValue();
      await Promise.all([
        firstValueFrom(this.http.patch('/api/v1/settings/ai', {
          workspaceId,
          key: 'ai.provider',
          value: 'GEMINI',
        })),
        firstValueFrom(this.http.patch('/api/v1/settings/ai', {
          workspaceId,
          key: 'ai.daily_budget_usd',
          value: values.dailyBudget,
        })),
        firstValueFrom(this.http.patch('/api/v1/settings/ai', {
          workspaceId,
          key: 'ai.enabled',
          value: values.enabled,
        })),
      ]);
      this.toast.success('AI settings saved');
    } catch {
      this.toast.error('Failed to save AI settings');
    } finally {
      this.saving.set(false);
    }
  }
}
