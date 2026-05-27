import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AiPrioritySuggestion,
  AiPrioritySuggestionApiService,
} from '../../stores/ai-priority-suggestion-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { TaskStore } from '../../stores/task.store';

const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  urgent: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', label: 'Urgent' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', label: 'High' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', label: 'Medium' },
  low: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200', label: 'Low' },
  none: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', label: 'None' },
};

@Component({
  selector: 'jt-priority-suggestions-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section
      class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70"
    >
      <header class="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5">
            <span class="pi pi-bolt text-[10px] text-indigo-600" aria-hidden="true"></span>
            <span class="text-[9px] font-bold uppercase tracking-[0.18em] text-indigo-700">
              AI suggestions
            </span>
          </div>
          <h2 class="text-lg font-black tracking-tight text-slate-950">
            Prioridad recomendada
          </h2>
          <p class="text-[11px] text-slate-500">
            Tareas con fecha cercana cuyo nivel de prioridad podr&iacute;a subir.
          </p>
        </div>
        @if (isAdmin()) {
          <button
            type="button"
            (click)="regenerate()"
            [disabled]="regenerating()"
            class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
          >
            <span
              [class]="
                'pi text-[10px] ' + (regenerating() ? 'pi-spin pi-spinner' : 'pi-refresh')
              "
              aria-hidden="true"
            ></span>
            {{ regenerating() ? 'Recomputando…' : 'Recomputar' }}
          </button>
        }
      </header>

      @if (loading()) {
        <div class="space-y-2">
          <div class="h-10 animate-pulse rounded-lg bg-slate-100"></div>
          <div class="h-10 animate-pulse rounded-lg bg-slate-100"></div>
        </div>
      } @else if (suggestions().length === 0) {
        <div class="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <span class="pi pi-check-circle text-[12px]" aria-hidden="true"></span>
          Sin recomendaciones por ahora. La IA volverá a chequear ma&ntilde;ana.
        </div>
      } @else {
        <ul class="space-y-2">
          @for (s of suggestions(); track s.id) {
            <li
              class="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs"
            >
              <a
                [routerLink]="['/tasks', s.taskId]"
                class="flex-1 min-w-0 truncate font-semibold text-slate-800 hover:text-indigo-700"
                [attr.title]="taskTitle(s.taskId)"
              >
                {{ taskTitle(s.taskId) || 'Tarea ' + s.taskId.slice(0, 8) }}
              </a>
              <span class="flex items-center gap-1.5">
                <span [class]="badgeClass(s.currentPriority)">
                  {{ priorityLabel(s.currentPriority) }}
                </span>
                <i class="pi pi-arrow-right text-[10px] text-slate-400" aria-hidden="true"></i>
                <span [class]="badgeClass(s.suggestedPriority)">
                  {{ priorityLabel(s.suggestedPriority) }}
                </span>
              </span>
              <span class="hidden text-[11px] text-slate-500 sm:inline">
                {{ s.reason }}
              </span>
              <span class="flex gap-1">
                <button
                  type="button"
                  (click)="accept(s)"
                  class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                  [attr.aria-label]="'Aplicar ' + priorityLabel(s.suggestedPriority)"
                >
                  <i class="pi pi-check text-[10px]" aria-hidden="true"></i>
                  Aplicar
                </button>
                <button
                  type="button"
                  (click)="dismiss(s)"
                  class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200"
                  aria-label="Descartar"
                >
                  <i class="pi pi-times text-[10px]" aria-hidden="true"></i>
                  Descartar
                </button>
              </span>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class PrioritySuggestionsWidgetComponent implements OnInit {
  private readonly api = inject(AiPrioritySuggestionApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly taskStore = inject(TaskStore);

  readonly loading = signal(true);
  readonly suggestions = signal<AiPrioritySuggestion[]>([]);
  readonly regenerating = signal(false);

  readonly isAdmin = computed(() => {
    const role = this.auth.currentWorkspace()?.role;
    return role === 'owner' || role === 'admin';
  });

  async ngOnInit(): Promise<void> {
    try {
      this.suggestions.set(await this.api.list());
    } catch {
      this.suggestions.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  taskTitle(taskId: string): string {
    const t = (this.taskStore.byId() as Record<string, { title?: string }>)[taskId];
    return t?.title ?? '';
  }

  priorityLabel(p: string): string {
    return PRIORITY_STYLES[p]?.label ?? p;
  }

  badgeClass(p: string): string {
    const s = PRIORITY_STYLES[p] ?? PRIORITY_STYLES['none'];
    return `inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.bg} ${s.text} ${s.border}`;
  }

  async accept(s: AiPrioritySuggestion): Promise<void> {
    try {
      await this.api.accept(s.id);
      this.suggestions.update((curr) => curr.filter((x) => x.id !== s.id));
      this.toast.success('Prioridad actualizada');
    } catch {
      this.toast.error('No pudimos aplicar la sugerencia');
    }
  }

  async dismiss(s: AiPrioritySuggestion): Promise<void> {
    try {
      await this.api.dismiss(s.id);
      this.suggestions.update((curr) => curr.filter((x) => x.id !== s.id));
    } catch {
      this.toast.error('No pudimos descartar');
    }
  }

  async regenerate(): Promise<void> {
    this.regenerating.set(true);
    try {
      await this.api.regenerate();
      this.suggestions.set(await this.api.list());
      this.toast.success('Sugerencias regeneradas');
    } catch {
      this.toast.error('No pudimos regenerar');
    } finally {
      this.regenerating.set(false);
    }
  }
}
