import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AiService } from '../../core/ai/ai.service';

/**
 * Wraps any element. After 700ms of hover the wrapped element triggers an
 * AI "explain in 2 sentences" call against the task id and pops a tiny
 * card with the result. Caches per task id for 5 minutes in the AiService
 * so flicking the mouse over a list never bills twice.
 *
 * Usage:
 *   <jt-ai-explain-popover [taskId]="task.id">
 *     <a routerLink="...">{{ task.title }}</a>
 *   </jt-ai-explain-popover>
 */
@Component({
  selector: 'jt-ai-explain-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      #anchor
      class="relative inline-block"
      (mouseenter)="schedule()"
      (mouseleave)="cancel()"
      (focusin)="schedule()"
      (focusout)="cancel()"
    >
      <ng-content />
      @if (open()) {
        <span
          role="tooltip"
          class="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-violet-200 bg-white p-3 shadow-xl shadow-slate-200/80"
        >
          <span
            class="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-violet-700"
          >
            <i class="pi pi-sparkles text-[10px]" aria-hidden="true"></i>
            AI
          </span>
          @if (loading()) {
            <span class="mt-1 block space-y-1.5">
              <span class="block h-2 w-3/4 animate-pulse rounded bg-slate-100"></span>
              <span class="block h-2 w-1/2 animate-pulse rounded bg-slate-100"></span>
            </span>
          } @else if (error()) {
            <span class="mt-1 block text-xs italic text-slate-400">
              {{ error() }}
            </span>
          } @else if (explanation()) {
            <span class="mt-1 block text-xs leading-relaxed text-slate-700">
              {{ explanation() }}
            </span>
          }
        </span>
      }
    </span>
  `,
})
export class AiExplainPopoverComponent {
  readonly taskId = input.required<string>();
  readonly delayMs = input<number>(700);

  private readonly ai = inject(AiService);
  readonly anchor = viewChild<ElementRef<HTMLElement>>('anchor');

  readonly open = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly explanation = signal<string | null>(null);

  private timerHandle: ReturnType<typeof setTimeout> | null = null;

  schedule(): void {
    if (this.open()) return;
    if (this.timerHandle) clearTimeout(this.timerHandle);
    this.timerHandle = setTimeout(() => {
      this.open.set(true);
      void this.fetch();
    }, this.delayMs());
  }

  cancel(): void {
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
    this.open.set(false);
  }

  private async fetch(): Promise<void> {
    if (this.explanation()) return; // already cached on this instance
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.ai.explainTask(this.taskId());
      this.explanation.set(res?.explanation ?? null);
    } catch {
      this.error.set('AI not available right now');
    } finally {
      this.loading.set(false);
    }
  }
}
