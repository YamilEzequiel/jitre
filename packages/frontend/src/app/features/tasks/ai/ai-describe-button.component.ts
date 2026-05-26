import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { AiService } from '../../../core/ai/ai.service';
import { ToastService } from '../../../core/toast/toast.service';

interface DescribeResult {
  description: string;
}

@Component({
  selector: 'jt-ai-describe-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="describe()"
      [disabled]="isLoading()"
      [attr.aria-busy]="isLoading()"
      class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white
             bg-gradient-to-r from-fuchsia-600 to-violet-600
             shadow-md shadow-fuchsia-500/25
             hover:shadow-lg hover:shadow-fuchsia-500/40
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60
             focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
             transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
    >
      @if (isLoading()) {
        <span class="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></span>
        Describing…
      } @else {
        <svg
          class="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        AI Describe
      }
    </button>
  `,
})
export class AiDescribeButtonComponent {
  readonly taskId = input.required<string>();
  readonly described = output<string>();

  private readonly ai = inject(AiService);
  private readonly toast = inject(ToastService);

  readonly isLoading = computed(() => this.ai.loading.describe());

  async describe(): Promise<void> {
    try {
      const result = await this.ai.describeTask(this.taskId()) as DescribeResult | null;
      if (result?.description) {
        this.described.emit(result.description);
      }
    } catch {
      this.toast.error('AI describe failed');
    }
  }
}
