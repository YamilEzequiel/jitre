import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import {
  AiDailyDigest,
  AiDailyDigestApiService,
} from '../../stores/ai-daily-digest-api.service';
import { ToastService } from '../../core/toast/toast.service';

@Component({
  selector: 'jt-daily-digest-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <section
      class="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/30 to-indigo-50/40 p-5 shadow-sm shadow-slate-200/70"
    >
      <header class="mb-3 flex items-start justify-between gap-3">
        <div class="space-y-1.5">
          <div class="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5">
            <span class="pi pi-sparkles text-[10px] text-violet-600" aria-hidden="true"></span>
            <span class="text-[9px] font-bold uppercase tracking-[0.18em] text-violet-700">
              {{ 'dashboard.dailyDigest.badge' | translate }}
            </span>
          </div>
          <h2 class="text-lg font-black tracking-tight text-slate-950">
            {{ 'dashboard.dailyDigest.title' | translate }}
          </h2>
          @if (digest(); as d) {
            <p class="text-[11px] font-medium text-slate-500">{{ d.digestDate }} · {{ d.model }}</p>
          }
        </div>
        @if (isAdmin()) {
          <button
            type="button"
            (click)="regenerate()"
            [disabled]="regenerating()"
            class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-60"
            aria-label="Regenerate digest"
          >
            <span
              [class]="
                'pi text-[10px] ' + (regenerating() ? 'pi-spin pi-spinner' : 'pi-refresh')
              "
              aria-hidden="true"
            ></span>
            {{ (regenerating() ? 'common.generating' : 'common.regenerate') | translate }}
          </button>
        }
      </header>

      @if (loading()) {
        <div class="space-y-2">
          <div class="h-3 w-3/4 animate-pulse rounded bg-slate-100"></div>
          <div class="h-3 w-2/3 animate-pulse rounded bg-slate-100"></div>
          <div class="h-3 w-1/2 animate-pulse rounded bg-slate-100"></div>
        </div>
      } @else if (digest(); as d) {
        @if (d.tasksCreated || d.tasksCompleted || d.commentsPosted || d.timeLoggedMinutes) {
          <div class="mb-4 grid grid-cols-4 gap-2">
            <div class="rounded-lg border border-emerald-100 bg-emerald-50/60 px-2 py-1.5">
              <p class="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700">{{ 'dashboard.dailyDigest.metrics.completed' | translate }}</p>
              <p class="text-base font-black tabular-nums text-emerald-900">{{ d.tasksCompleted }}</p>
            </div>
            <div class="rounded-lg border border-indigo-100 bg-indigo-50/60 px-2 py-1.5">
              <p class="text-[9px] font-bold uppercase tracking-[0.16em] text-indigo-700">{{ 'dashboard.dailyDigest.metrics.created' | translate }}</p>
              <p class="text-base font-black tabular-nums text-indigo-900">{{ d.tasksCreated }}</p>
            </div>
            <div class="rounded-lg border border-fuchsia-100 bg-fuchsia-50/60 px-2 py-1.5">
              <p class="text-[9px] font-bold uppercase tracking-[0.16em] text-fuchsia-700">{{ 'dashboard.dailyDigest.metrics.comments' | translate }}</p>
              <p class="text-base font-black tabular-nums text-fuchsia-900">{{ d.commentsPosted }}</p>
            </div>
            <div class="rounded-lg border border-amber-100 bg-amber-50/60 px-2 py-1.5">
              <p class="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-700">{{ 'dashboard.dailyDigest.metrics.time' | translate }}</p>
              <p class="text-base font-black tabular-nums text-amber-900">{{ hoursLabel(d.timeLoggedMinutes) }}</p>
            </div>
          </div>
        }
        <article
          class="digest-prose prose prose-sm max-w-none text-slate-700"
          [innerHTML]="summaryHtml()"
        ></article>
      } @else {
        <div class="flex flex-col items-center gap-2 py-6 text-center text-sm text-slate-500">
          <span class="pi pi-moon text-2xl text-slate-300" aria-hidden="true"></span>
          <p>{{ 'dashboard.dailyDigest.empty' | translate }}</p>
          @if (isAdmin()) {
            <button
              type="button"
              (click)="regenerate()"
              [disabled]="regenerating()"
              class="mt-2 inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
            >
              <span class="pi pi-sparkles text-[10px]" aria-hidden="true"></span>
              {{ (regenerating() ? 'common.generating' : 'dashboard.dailyDigest.generateNow') | translate }}
            </button>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .digest-prose h3 {
        font-size: 0.75rem;
        font-weight: 800;
        color: rgb(15, 23, 42);
        text-transform: uppercase;
        letter-spacing: 0.14em;
        margin: 1rem 0 0.35rem 0;
      }
      .digest-prose h3:first-child {
        margin-top: 0;
      }
      .digest-prose p {
        margin: 0 0 0.55rem 0;
        line-height: 1.55;
      }
      .digest-prose ul,
      .digest-prose ol {
        margin: 0 0 0.55rem 0;
        padding-left: 1.25rem;
      }
      .digest-prose strong {
        color: rgb(15, 23, 42);
        font-weight: 700;
      }
      .digest-prose code {
        background: rgb(243, 244, 246);
        padding: 0 0.3rem;
        border-radius: 0.25rem;
        font-size: 0.82em;
      }
    `,
  ],
})
export class DailyDigestWidgetComponent implements OnInit {
  private readonly api = inject(AiDailyDigestApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslateService);

  readonly loading = signal(true);
  readonly digest = signal<AiDailyDigest | null>(null);
  readonly regenerating = signal(false);

  readonly isAdmin = computed(() => {
    const role = this.auth.currentWorkspace()?.role;
    return role === 'owner' || role === 'admin';
  });

  readonly summaryHtml = computed<string>(() => {
    const d = this.digest();
    if (!d?.summary) return '';
    const html = marked.parse(d.summary, { async: false }) as string;
    return DOMPurify.sanitize(html);
  });

  async ngOnInit(): Promise<void> {
    try {
      this.digest.set(await this.api.latest());
    } catch {
      this.digest.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  hoursLabel(minutes: number): string {
    if (!minutes) return '0h';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }

  async regenerate(): Promise<void> {
    this.regenerating.set(true);
    try {
      this.digest.set(await this.api.regenerate());
      this.toast.success(this.t.instant('dashboard.dailyDigest.successToast'));
    } catch {
      this.toast.error(this.t.instant('dashboard.dailyDigest.failedToast'));
    } finally {
      this.regenerating.set(false);
    }
  }
}
