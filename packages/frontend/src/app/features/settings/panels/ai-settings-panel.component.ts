import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { AuthService } from '../../../core/auth/auth.service';
import { WorkspaceMemberStore } from '../../../stores/workspace-member.store';
import { CheckboxComponent } from '../../../shared/checkbox/checkbox.component';

interface AiSettingsResponse {
  'ai.provider'?: 'GEMINI' | 'OPENAI' | 'ANTHROPIC';
  'ai.daily_budget_usd'?: number;
  'ai.enabled'?: boolean;
  'ai.gemini.model'?: string;
}

interface AiUsagePoint {
  costUsd: string;
  bucket?: string;
}

interface UsageBucket {
  bucket: string;
  count: number;
  totalCost: string;
}

interface AiUsageByUserResponse {
  userId: string;
  requests: number;
  costUsd: string;
}

interface AiUsageByOperationResponse {
  operation: string;
  requests: number;
  costUsd: string;
  avgLatencyMs?: number;
}

interface AiUsagePointResponse {
  period: string;
  requests: number;
  costUsd: string;
  totalTokens?: number;
}

const GEMINI_MODEL_OPTIONS = [
  { label: 'Gemini 2.5 Flash (recomendado — rápido y económico)', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Pro (más capaz, más caro)', value: 'gemini-2.5-pro' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 2.0 Flash Exp (experimental)', value: 'gemini-2.0-flash-exp' },
];

@Component({
  selector: 'jt-ai-settings-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectModule, CheckboxComponent],
  template: `
    <section
      class="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7
             shadow-sm shadow-slate-200/70 space-y-7"
    >
      <header>
        <h2 class="text-xl font-bold tracking-tight text-slate-950">IA & Cuota</h2>
        <p class="mt-1 text-sm text-slate-500">
          Configurá el proveedor de IA, el presupuesto diario y habilitá las funciones generativas
          (borradores de tareas, sub-tareas asistidas, resúmenes y búsqueda semántica).
        </p>
      </header>

      <!-- ── Usage at-a-glance ──────────────────────────────────────────── -->
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <article class="rounded-xl border border-slate-200 bg-white p-4">
          <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Hoy</p>
          <p class="mt-1 text-2xl font-black text-slate-950 tabular-nums">USD {{ spentToday() ?? '0.0000' }}</p>
          <div class="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div class="h-full transition-all" [class]="budgetColor()" [style.width.%]="budgetPct()"></div>
          </div>
          <p class="mt-1 text-[11px] text-slate-400">{{ budgetPct() }}% del presupuesto diario</p>
        </article>
        <article class="rounded-xl border border-slate-200 bg-white p-4">
          <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Últimos 30 días</p>
          <p class="mt-1 text-2xl font-black text-slate-950 tabular-nums">USD {{ usage30Days() ?? '0.00' }}</p>
          <p class="mt-1 text-[11px] text-slate-400">Costo total acumulado</p>
        </article>
        <article class="rounded-xl border border-slate-200 bg-white p-4">
          <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Llamadas (30d)</p>
          <p class="mt-1 text-2xl font-black text-slate-950 tabular-nums">{{ totalCallsFor(callsByDay()) }}</p>
          <p class="mt-1 text-[11px] text-slate-400">Total de requests a la IA</p>
        </article>
      </section>

      <!-- ── Breakdown por operación + usuario ────────────────────────── -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <article class="rounded-xl border border-slate-200 bg-white p-5">
          <h3 class="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-3">Por operación · 30 días</h3>
          @if (callsByOperation().length === 0) {
            <p class="text-xs italic text-slate-400">Sin datos.</p>
          } @else {
            <ul class="space-y-2">
              @for (b of callsByOperation(); track b.bucket) {
                <li class="flex items-center justify-between gap-3 text-xs">
                  <span class="rounded bg-violet-50 px-2 py-0.5 font-mono text-[11px] text-violet-700">{{ b.bucket }}</span>
                  <span class="text-slate-400">{{ b.count }} llamada{{ b.count === 1 ? '' : 's' }}</span>
                  <span class="font-semibold text-slate-900 tabular-nums">USD {{ b.totalCost }}</span>
                </li>
              }
            </ul>
          }
        </article>
        <article class="rounded-xl border border-slate-200 bg-white p-5">
          <h3 class="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-3">Por usuario · 30 días</h3>
          @if (callsByUser().length === 0) {
            <p class="text-xs italic text-slate-400">Sin datos.</p>
          } @else {
            <ul class="space-y-2">
              @for (b of callsByUser(); track b.bucket) {
                <li class="flex items-center justify-between gap-3 text-xs">
                  <span class="truncate max-w-[16rem] text-slate-700">{{ userLabel(b.bucket) }}</span>
                  <span class="text-slate-400">{{ b.count }}</span>
                  <span class="font-semibold text-slate-900 tabular-nums">USD {{ b.totalCost }}</span>
                </li>
              }
            </ul>
          }
        </article>
      </section>

      @if (errorMessage()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p class="font-semibold">No pudimos guardar la configuración</p>
          <p class="text-xs">{{ errorMessage() }}</p>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="save()" class="space-y-5 max-w-md" novalidate>
        <div>
          <label for="ai-provider" class="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">
            Proveedor de IA
          </label>
          <p-select
            inputId="ai-provider"
            formControlName="provider"
            [options]="providerOptions"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            styleClass="w-full"
          />
          <p class="mt-2 text-xs text-slate-500">
            Gemini es el único proveedor activo. Anthropic / OpenAI están preparados pero todavía como stubs.
          </p>
        </div>

        <div>
          <label for="ai-model" class="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">
            Modelo
          </label>
          <p-select
            inputId="ai-model"
            formControlName="model"
            [options]="modelOptions"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            styleClass="w-full"
          />
          <p class="mt-2 text-xs text-slate-500">
            Flash es más rápido y barato (~$0.075/M tokens). Pro es más capaz pero ~16× más caro (~$1.25/M tokens). El backend respeta esta elección en cada request.
          </p>
        </div>

        <div>
          <label for="ai-budget" class="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">
            Presupuesto diario (USD)
          </label>
          <input
            id="ai-budget"
            type="number"
            formControlName="dailyBudget"
            min="0.01"
            step="0.01"
            class="w-full rounded-lg bg-white border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
          />
          <p class="mt-2 text-xs text-slate-500">
            Tope de gasto por día. Cuando se supera, las llamadas de IA devuelven 429 hasta el corte de día siguiente.
          </p>
        </div>

        <label class="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-slate-200 bg-white p-4 hover:border-violet-300 transition">
          <jt-checkbox formControlName="enabled" ariaLabel="Habilitar funciones de IA" />
          <span>
            <span class="block text-sm font-semibold text-slate-900">Habilitar funciones de IA</span>
            <span class="block text-xs text-slate-500 mt-0.5">
              Cuando está habilitado, el botón “Crear con IA” aparece en la UI y las acciones de IA en tareas/comentarios funcionan.
              Si lo desactivás, los endpoints de IA devuelven 403 hasta volver a habilitarlo.
            </span>
          </span>
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
            Guardando…
          } @else {
            Guardar configuración
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
  private readonly memberStore = inject(WorkspaceMemberStore);
  private readonly fb = inject(FormBuilder);

  /** Resolve a UUID → display name via the workspace member store. */
  protected userLabel(userId: string): string {
    return this.memberStore.displayNameFor(userId, userId.slice(0, 8));
  }

  readonly saving = signal(false);
  readonly spentUsd = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly providerOptions = [{ label: 'Gemini', value: 'GEMINI' }];

  readonly form = this.fb.group({
    provider: ['GEMINI', Validators.required],
    model: ['gemini-2.5-flash', Validators.required],
    dailyBudget: [5, [Validators.required, Validators.min(0.01)]],
    enabled: [false],
  });

  readonly modelOptions = GEMINI_MODEL_OPTIONS;

  // Usage analytics
  readonly spentToday = signal<string | null>(null);
  readonly usage30Days = signal<string | null>(null);
  readonly callsByOperation = signal<UsageBucket[]>([]);
  readonly callsByUser = signal<UsageBucket[]>([]);
  readonly callsByDay = signal<UsageBucket[]>([]);

  ngOnInit(): void {
    const range = this.analytics.lastNDays(30);
    this.analytics.getAiUsage(range.from, range.to)
      .then(raw => {
        const total = (raw as AiUsagePoint[]).reduce(
          (sum, point) => sum + Number(point.costUsd ?? 0),
          0,
        );
        this.spentUsd.set(total.toFixed(2));
        this.usage30Days.set(total.toFixed(2));
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
        model: s['ai.gemini.model'] ?? 'gemini-2.5-flash',
        dailyBudget: s['ai.daily_budget_usd'] ?? 5,
        enabled: s['ai.enabled'] ?? false,
      }))
      .catch(() => undefined);

    this.loadUsageBreakdown();
  }

  /**
   * Pull three usage views off the analytics endpoint: per-day cost trend,
   * per-operation breakdown (where is the budget actually going?), per-user
   * breakdown (who is using the most). Each one fails open — if the endpoint
   * isn't reachable the panel still renders.
   */
  private loadUsageBreakdown(): void {
    const range = this.analytics.lastNDays(30);

    // Per-day cost trend over the last 30 days.
    void firstValueFrom(
      this.http.get<AiUsagePointResponse[]>('/api/v1/analytics/workspace/ai-usage', {
        params: { from: range.from, to: range.to, period: 'day' },
      }),
    )
      .then(points => {
        this.callsByDay.set(
          points.map(p => ({ bucket: p.period, count: p.requests, totalCost: p.costUsd })),
        );
      })
      .catch(() => this.callsByDay.set([]));

    // Per-operation breakdown. AnalyticsPeriodDto requires `period` even
    // though by-operation aggregates across the whole range — pass 'day' as
    // a no-op granularity so validation passes.
    void firstValueFrom(
      this.http.get<AiUsageByOperationResponse[]>('/api/v1/analytics/workspace/ai-usage/by-operation', {
        params: { from: range.from, to: range.to, period: 'day' },
      }),
    )
      .then(rows => {
        this.callsByOperation.set(
          rows.map(r => ({ bucket: r.operation, count: r.requests, totalCost: r.costUsd })),
        );
      })
      .catch(() => this.callsByOperation.set([]));

    // Per-user breakdown (admin-gated server-side; the call simply 403s
    // for non-admins and we render the empty state).
    void firstValueFrom(
      this.http.get<AiUsageByUserResponse[]>('/api/v1/analytics/workspace/ai-usage/by-user', {
        params: { from: range.from, to: range.to, period: 'day' },
      }),
    )
      .then(rows => {
        this.callsByUser.set(
          rows.map(r => ({ bucket: r.userId, count: r.requests, totalCost: r.costUsd })),
        );
      })
      .catch(() => this.callsByUser.set([]));

    // Today-only single-day cost (sum of granularity=day bucket from today
    // start to now). Reuse the same endpoint with a 1-day window.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const tomorrowIso = new Date(today.getTime() + 24 * 3600 * 1000).toISOString();
    void firstValueFrom(
      this.http.get<AiUsagePointResponse[]>('/api/v1/analytics/workspace/ai-usage', {
        params: { from: todayIso, to: tomorrowIso, period: 'day' },
      }),
    )
      .then(points => {
        const t = points.reduce((s, p) => s + Number(p.costUsd ?? 0), 0);
        this.spentToday.set(t.toFixed(4));
      })
      .catch(() => this.spentToday.set('0.0000'));
  }

  totalCostFor(buckets: UsageBucket[]): string {
    return buckets.reduce((s, b) => s + Number(b.totalCost ?? 0), 0).toFixed(4);
  }

  totalCallsFor(buckets: UsageBucket[]): number {
    return buckets.reduce((s, b) => s + (b.count ?? 0), 0);
  }

  budgetPct(): number {
    const today = Number(this.spentToday() ?? 0);
    const budget = Number(this.form.get('dailyBudget')?.value ?? 5);
    if (budget <= 0) return 0;
    return Math.min(100, Math.round((today / budget) * 100));
  }

  budgetColor(): string {
    const pct = this.budgetPct();
    if (pct >= 90) return 'bg-rose-400';
    if (pct >= 70) return 'bg-amber-400';
    return 'bg-emerald-400';
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) {
      this.toast.error('No hay workspace activo');
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const values = this.form.getRawValue();
      // Sequential writes so we can pinpoint which key failed (helpful in
      // the error toast / inline banner). The three writes are cheap.
      await firstValueFrom(this.http.patch('/api/v1/settings/ai', {
        workspaceId, key: 'ai.provider', value: 'GEMINI',
      }));
      await firstValueFrom(this.http.patch('/api/v1/settings/ai', {
        workspaceId, key: 'ai.gemini.model', value: values.model,
      }));
      await firstValueFrom(this.http.patch('/api/v1/settings/ai', {
        workspaceId, key: 'ai.daily_budget_usd', value: values.dailyBudget,
      }));
      await firstValueFrom(this.http.patch('/api/v1/settings/ai', {
        workspaceId, key: 'ai.enabled', value: values.enabled,
      }));
      this.toast.success('Configuración de IA guardada');
      this.loadUsageBreakdown();
    } catch (err) {
      const detail =
        (err as { error?: { detail?: string } })?.error?.detail ??
        (err instanceof Error ? err.message : 'Error desconocido');
      this.errorMessage.set(detail);
      this.toast.error(`No pudimos guardar: ${detail}`);
    } finally {
      this.saving.set(false);
    }
  }
}
