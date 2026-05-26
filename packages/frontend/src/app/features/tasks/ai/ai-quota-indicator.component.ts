import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { AuthService } from '../../../core/auth/auth.service';

interface AiUsagePoint {
  costUsd: string;
}

@Component({
  selector: 'jt-ai-quota-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isAdmin()) {
      <div
        class="rounded-xl border border-slate-200 bg-white
               px-4 py-3 shadow-sm shadow-slate-200/70"
      >
        <div class="flex items-center justify-between mb-2">
          <span
            class="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500"
          >
            <span
              class="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-violet-400 animate-pulse"
              aria-hidden="true"
            ></span>
            AI Spend · 30 days
          </span>
          @if (spentUsd()) {
            <span class="text-xs font-semibold text-slate-600">
              <span class="text-slate-400">USD </span>
              <span class="text-slate-950">{{ spentUsd() }}</span>
            </span>
          }
        </div>
      </div>
    }
  `,
})
export class AiQuotaIndicatorComponent implements OnInit {
  private readonly analytics = inject(AnalyticsService);
  private readonly auth = inject(AuthService);

  readonly spentUsd = signal<string | null>(null);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  ngOnInit(): void {
    if (this.isAdmin()) {
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
    }
  }
}
