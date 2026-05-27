import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AiService } from '../../../core/ai/ai.service';
import { TaskApiService, Task } from '../../../stores/task-api.service';
import { TaskStore } from '../../../stores/task.store';
import { WorkflowStatusStore } from '../../../stores/workflow-status.store';
import { ToastService } from '../../../core/toast/toast.service';
import { CheckboxComponent } from '../../../shared/checkbox/checkbox.component';

interface SuggestResult {
  subtasks: string[];
}

@Component({
  selector: 'jt-ai-subtask-suggest',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent],
  template: `
    <div>
      <button
        type="button"
        (click)="fetchSuggestions()"
        [disabled]="isLoading()"
        class="group inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white
               bg-gradient-to-r from-fuchsia-600 to-violet-600
               shadow-md shadow-fuchsia-500/25
               hover:shadow-lg hover:shadow-fuchsia-500/40
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60
               focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
               transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
      >
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
        @if (isLoading()) { Loading… } @else { Suggest Subtasks }
      </button>

      @if (suggestions().length > 0) {
        <div
          class="mt-4 rounded-2xl border border-slate-200 bg-white p-5
                 shadow-sm shadow-slate-200/70"
        >
          <p
            class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-3"
          >
            Suggested subtasks
          </p>
          <div class="space-y-1.5">
            @for (s of suggestions(); track s) {
              <label
                class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
                       border border-transparent hover:bg-white hover:border-slate-200
                       transition-colors"
              >
                <jt-checkbox
                  [checked]="checked().has(s)"
                  (checkedChange)="toggleCheck(s)"
                />
                <span class="text-sm text-slate-700">{{ s }}</span>
              </label>
            }
          </div>
          <div class="flex gap-2 mt-4">
            <button
              type="button"
              (click)="confirm()"
              [disabled]="checked().size === 0"
              class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white
                     bg-gradient-to-r from-indigo-600 to-violet-600
                     shadow-md shadow-indigo-500/25
                     hover:shadow-lg hover:shadow-indigo-500/40
                     transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create Selected
            </button>
            <button
              type="button"
              (click)="suggestions.set([])"
              class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-600
                     bg-white border border-slate-200 backdrop-blur-sm
                     hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700
                     transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class AiSubtaskSuggestComponent {
  readonly taskId = input.required<string>();
  readonly projectId = input.required<string>();
  readonly subtasksCreated = output<void>();

  private readonly ai = inject(AiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly taskStore = inject(TaskStore);
  private readonly statusStore = inject(WorkflowStatusStore);
  private readonly toast = inject(ToastService);

  readonly suggestions = signal<string[]>([]);
  readonly checked = signal<Set<string>>(new Set());
  readonly isLoading = computed(() => this.ai.loading.suggestSubtasks());

  async fetchSuggestions(): Promise<void> {
    try {
      const result = await this.ai.suggestSubtasks(this.taskId()) as SuggestResult | null;
      if (result?.subtasks) {
        this.suggestions.set(result.subtasks);
        this.checked.set(new Set(result.subtasks));
      }
    } catch {
      this.toast.error('Failed to get suggestions');
    }
  }

  toggleCheck(title: string): void {
    this.checked.update(s => {
      const next = new Set(s);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }

  async confirm(): Promise<void> {
    const toCreate = [...this.checked()];
    const projectId = this.projectId();
    const statusId = this.resolveStatusId();
    if (!statusId) {
      this.toast.error('No status available — load workflow statuses first');
      return;
    }
    const parentTaskId = this.taskId();
    const promises = toCreate.map(title =>
      this.taskApi
        .create(projectId, { title, statusId, parentTaskId })
        .then((task: Task) => this.taskStore.upsert(task)),
    );
    try {
      await Promise.all(promises);
      this.toast.success(`${toCreate.length} subtask(s) created`);
      this.subtasksCreated.emit();
      this.suggestions.set([]);
      this.checked.set(new Set());
    } catch {
      this.toast.error('Failed to create some subtasks');
    }
  }

  private resolveStatusId(): string | null {
    // Prefer parent task's status (subtask context), then fall back to project default.
    const parent = (this.taskStore.byId() as Record<string, Task>)[this.taskId()];
    if (parent?.statusId) return parent.statusId;
    const list = this.statusStore.byProject(this.projectId())();
    if (list.length === 0) return null;
    const def = list.find(s => s.isDefault);
    return (def ?? list[0]).id;
  }
}
