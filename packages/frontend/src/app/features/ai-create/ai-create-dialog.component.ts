import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TaskPriority } from '@jitre/shared';
import type {
  AiDocDraft,
  AiGeneratorDraft,
  AiProjectDraft,
  AiTaskDraft,
  AiTaskWithSubtasksDraft,
} from '@jitre/shared';
import { AiGeneratorApiService } from '../../core/ai/ai-generator.service';
import { ToastService } from '../../core/toast/toast.service';
import { ProjectStore } from '../../stores/project.store';
import { AiCreateService } from './ai-create.service';

type DialogMode = 'idle' | 'loading' | 'preview' | 'committing';

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: TaskPriority.LOW, label: 'Low' },
  { value: TaskPriority.MEDIUM, label: 'Medium' },
  { value: TaskPriority.HIGH, label: 'High' },
  { value: TaskPriority.URGENT, label: 'Urgent' },
];

@Component({
  selector: 'jt-ai-create-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    @if (state.isOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 p-6 pt-20 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-create-title"
        (click)="close()"
      >
        <section
          class="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
          (click)="$event.stopPropagation()"
        >
          <header class="mb-5 flex items-start justify-between gap-3">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600">AI</p>
              <h2 id="ai-create-title" class="mt-1 text-xl font-black text-slate-950">
                Create from a prompt
              </h2>
              <p class="text-sm text-slate-500">
                Describe what you need. The AI proposes a draft you can edit before saving.
              </p>
            </div>
            <button
              type="button"
              (click)="close()"
              class="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close"
            >
              <i class="pi pi-times text-xs" aria-hidden="true"></i>
            </button>
          </header>

          @if (mode() === 'idle' || mode() === 'loading') {
            <label class="block">
              <span class="sr-only">Prompt</span>
              <textarea
                #promptInput
                [(ngModel)]="prompt"
                rows="4"
                [disabled]="mode() === 'loading'"
                placeholder="e.g. 'Plan the launch of the new pricing page with 5 substeps'"
                class="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900
                       placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none"
                (keydown.meta.enter)="generate()"
                (keydown.control.enter)="generate()"
              ></textarea>
            </label>

            <div class="mt-3 flex flex-wrap items-center gap-2">
              <label class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Project
              </label>
              <select
                [ngModel]="selectedProjectId()"
                (ngModelChange)="selectedProjectId.set($event)"
                [disabled]="mode() === 'loading'"
                class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700
                       focus:border-violet-400 focus:outline-none"
              >
                <option [ngValue]="null">No project</option>
                @for (project of projects(); track project.id) {
                  <option [ngValue]="project.id">{{ project.name }}</option>
                }
              </select>
            </div>

            @if (errorMessage()) {
              <p class="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {{ errorMessage() }}
              </p>
            }

            <div class="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                (click)="close()"
                class="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                (click)="generate()"
                [disabled]="!canGenerate()"
                class="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white
                       transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                @if (mode() === 'loading') {
                  <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>
                  Generating…
                } @else {
                  <i class="pi pi-sparkles text-xs" aria-hidden="true"></i>
                  Generate draft
                }
              </button>
            </div>
          }

          @if (mode() === 'preview' || mode() === 'committing') {
            @if (draftKind() === 'task') {
              <section class="space-y-3" aria-label="Task draft">
                <p class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">
                  <i class="pi pi-check-square text-[9px]" aria-hidden="true"></i>
                  Task draft
                </p>
                <label class="block">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Title</span>
                  <input
                    type="text"
                    [ngModel]="taskTitle()"
                    (ngModelChange)="taskTitle.set($event)"
                    class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  />
                </label>
                <label class="block">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Description</span>
                  <textarea
                    rows="3"
                    [ngModel]="taskDescription()"
                    (ngModelChange)="taskDescription.set($event)"
                    class="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  ></textarea>
                </label>
                <div class="flex flex-wrap items-center gap-3">
                  <label class="flex items-center gap-2 text-xs text-slate-600">
                    Priority
                    <select
                      [ngModel]="taskPriority()"
                      (ngModelChange)="taskPriority.set($event)"
                      class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700
                             focus:border-violet-400 focus:outline-none"
                    >
                      <option [ngValue]="null">—</option>
                      @for (option of priorities; track option.value) {
                        <option [ngValue]="option.value">{{ option.label }}</option>
                      }
                    </select>
                  </label>
                  <label class="flex items-center gap-2 text-xs text-slate-600">
                    Project
                    <select
                      [ngModel]="taskProjectId()"
                      (ngModelChange)="taskProjectId.set($event)"
                      class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700
                             focus:border-violet-400 focus:outline-none"
                    >
                      <option [ngValue]="null">No project</option>
                      @for (project of projects(); track project.id) {
                        <option [ngValue]="project.id">{{ project.name }}</option>
                      }
                    </select>
                  </label>
                </div>
              </section>
            }

            @if (draftKind() === 'task_with_subtasks') {
              <section class="space-y-3" aria-label="Task with subtasks draft">
                <p class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">
                  <i class="pi pi-sitemap text-[9px]" aria-hidden="true"></i>
                  Task + subtasks draft
                </p>
                <label class="block">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Parent title</span>
                  <input
                    type="text"
                    [ngModel]="parentTitle()"
                    (ngModelChange)="parentTitle.set($event)"
                    class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  />
                </label>
                <label class="block">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Parent description</span>
                  <textarea
                    rows="2"
                    [ngModel]="parentDescription()"
                    (ngModelChange)="parentDescription.set($event)"
                    class="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  ></textarea>
                </label>
                <div class="flex flex-wrap items-center gap-3">
                  <label class="flex items-center gap-2 text-xs text-slate-600">
                    Priority
                    <select
                      [ngModel]="parentPriority()"
                      (ngModelChange)="parentPriority.set($event)"
                      class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700
                             focus:border-violet-400 focus:outline-none"
                    >
                      <option [ngValue]="null">—</option>
                      @for (option of priorities; track option.value) {
                        <option [ngValue]="option.value">{{ option.label }}</option>
                      }
                    </select>
                  </label>
                  <label class="flex items-center gap-2 text-xs text-slate-600">
                    Project
                    <select
                      [ngModel]="parentProjectId()"
                      (ngModelChange)="parentProjectId.set($event)"
                      class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700
                             focus:border-violet-400 focus:outline-none"
                    >
                      <option [ngValue]="null">No project</option>
                      @for (project of projects(); track project.id) {
                        <option [ngValue]="project.id">{{ project.name }}</option>
                      }
                    </select>
                  </label>
                </div>

                <div>
                  <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">
                    Subtasks ({{ subtasks().length }})
                  </p>
                  <ul class="space-y-2">
                    @for (subtask of subtasks(); track $index) {
                      <li class="flex items-center gap-2">
                        <input
                          type="text"
                          [ngModel]="subtask.title"
                          (ngModelChange)="updateSubtask($index, $event)"
                          class="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                                 focus:border-violet-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          (click)="removeSubtask($index)"
                          class="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          [attr.aria-label]="'Remove subtask ' + ($index + 1)"
                        >
                          <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                        </button>
                      </li>
                    }
                  </ul>
                </div>
              </section>
            }

            @if (draftKind() === 'doc') {
              <section class="space-y-3" aria-label="Doc draft">
                <p class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">
                  <i class="pi pi-file text-[9px]" aria-hidden="true"></i>
                  Doc draft
                </p>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    [ngModel]="docIcon()"
                    (ngModelChange)="docIcon.set($event)"
                    maxlength="3"
                    placeholder="📄"
                    class="w-12 rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-lg
                           focus:border-violet-400 focus:outline-none"
                    aria-label="Doc icon"
                  />
                  <input
                    type="text"
                    [ngModel]="docTitle()"
                    (ngModelChange)="docTitle.set($event)"
                    placeholder="Page title"
                    class="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  />
                </div>
                <label class="block">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Body</span>
                  <textarea
                    rows="5"
                    [ngModel]="docBody()"
                    (ngModelChange)="docBody.set($event)"
                    class="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  ></textarea>
                </label>
                <label class="flex items-center gap-2 text-xs text-slate-600">
                  Project
                  <select
                    [ngModel]="docProjectId()"
                    (ngModelChange)="docProjectId.set($event)"
                    class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700
                           focus:border-violet-400 focus:outline-none"
                  >
                    <option [ngValue]="null">Workspace (no project)</option>
                    @for (project of projects(); track project.id) {
                      <option [ngValue]="project.id">{{ project.name }}</option>
                    }
                  </select>
                </label>
              </section>
            }

            @if (draftKind() === 'project') {
              <section class="space-y-3" aria-label="Project draft">
                <p class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">
                  <i class="pi pi-briefcase text-[9px]" aria-hidden="true"></i>
                  Project draft
                </p>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    [ngModel]="projectIcon()"
                    (ngModelChange)="projectIcon.set($event)"
                    maxlength="3"
                    placeholder="🚀"
                    class="w-12 rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-lg
                           focus:border-violet-400 focus:outline-none"
                    aria-label="Project icon"
                  />
                  <input
                    type="text"
                    [ngModel]="projectName()"
                    (ngModelChange)="projectName.set($event)"
                    placeholder="Project name"
                    class="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <label class="flex items-center gap-2 text-xs text-slate-600">
                    Key
                    <input
                      type="text"
                      [ngModel]="projectKey()"
                      (ngModelChange)="projectKey.set($event)"
                      maxlength="5"
                      class="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono uppercase
                             text-slate-700 focus:border-violet-400 focus:outline-none"
                    />
                  </label>
                  <label class="flex items-center gap-2 text-xs text-slate-600">
                    Color
                    <input
                      type="color"
                      [ngModel]="projectColor() ?? '#6366F1'"
                      (ngModelChange)="projectColor.set($event)"
                      class="h-8 w-12 rounded-md border border-slate-200 bg-white"
                    />
                  </label>
                </div>
                <label class="block">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Description</span>
                  <textarea
                    rows="3"
                    [ngModel]="projectDescription()"
                    (ngModelChange)="projectDescription.set($event)"
                    class="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  ></textarea>
                </label>
              </section>
            }

            @if (errorMessage()) {
              <p class="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {{ errorMessage() }}
              </p>
            }

            <div class="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                (click)="restart()"
                [disabled]="mode() === 'committing'"
                class="rounded-full px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <i class="pi pi-refresh text-[10px] mr-1" aria-hidden="true"></i>
                Re-generate
              </button>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="close()"
                  [disabled]="mode() === 'committing'"
                  class="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Discard
                </button>
                <button
                  type="button"
                  (click)="commit()"
                  [disabled]="!canCommit()"
                  class="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white
                         transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  @if (mode() === 'committing') {
                    <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>
                    Creating…
                  } @else {
                    <i class="pi pi-check text-xs" aria-hidden="true"></i>
                    Create
                  }
                </button>
              </div>
            </div>
          }
        </section>
      </div>
    }
  `,
})
export class AiCreateDialogComponent {
  protected readonly state = inject(AiCreateService);
  private readonly api = inject(AiGeneratorApiService);
  private readonly projectStore = inject(ProjectStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly mode = signal<DialogMode>('idle');
  protected readonly prompt = signal('');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selectedProjectId = signal<string | null>(null);

  protected readonly priorities = PRIORITIES;
  protected readonly projects = computed(() => this.projectStore.items());

  // ── task draft fields
  private readonly _draftKind = signal<AiGeneratorDraft['kind'] | null>(null);
  protected readonly draftKind = this._draftKind.asReadonly();

  protected readonly taskTitle = signal('');
  protected readonly taskDescription = signal('');
  protected readonly taskPriority = signal<TaskPriority | null>(null);
  protected readonly taskProjectId = signal<string | null>(null);

  // ── task_with_subtasks fields
  protected readonly parentTitle = signal('');
  protected readonly parentDescription = signal('');
  protected readonly parentPriority = signal<TaskPriority | null>(null);
  protected readonly parentProjectId = signal<string | null>(null);
  protected readonly subtasks = signal<Array<{ title: string; description: string | null }>>([]);

  // ── doc fields
  protected readonly docTitle = signal('');
  protected readonly docIcon = signal<string | null>(null);
  protected readonly docBody = signal('');
  protected readonly docProjectId = signal<string | null>(null);

  // ── project fields
  protected readonly projectName = signal('');
  protected readonly projectKey = signal('');
  protected readonly projectDescription = signal('');
  protected readonly projectIcon = signal<string | null>(null);
  protected readonly projectColor = signal<string | null>(null);

  protected readonly canGenerate = computed(
    () => this.mode() === 'idle' && this.prompt().trim().length >= 3,
  );

  protected readonly canCommit = computed(() => {
    if (this.mode() !== 'preview') return false;
    if (this._draftKind() === 'task') return this.taskTitle().trim().length > 0;
    if (this._draftKind() === 'task_with_subtasks') {
      return (
        this.parentTitle().trim().length > 0 &&
        this.subtasks().some((s) => s.title.trim().length > 0)
      );
    }
    if (this._draftKind() === 'doc') return this.docTitle().trim().length > 0;
    if (this._draftKind() === 'project') {
      return (
        this.projectName().trim().length > 0 &&
        this.projectKey().trim().length >= 3
      );
    }
    return false;
  });

  constructor() {
    effect(() => {
      // Reset transient state every time the dialog opens.
      if (this.state.isOpen()) {
        this.resetState();
      }
    });
  }

  protected async generate(): Promise<void> {
    if (!this.canGenerate()) return;
    this.mode.set('loading');
    this.errorMessage.set(null);
    try {
      const response = await this.api.draft({
        prompt: this.prompt(),
        context: this.selectedProjectId() ? { projectId: this.selectedProjectId()! } : undefined,
      });
      const draft = response.drafts[0];
      if (!draft) {
        throw new Error('Empty draft list');
      }
      this.applyDraft(draft);
      this.mode.set('preview');
    } catch (err) {
      this.errorMessage.set(this.formatError(err, 'Could not generate a draft.'));
      this.mode.set('idle');
    }
  }

  protected async commit(): Promise<void> {
    if (!this.canCommit()) return;
    this.mode.set('committing');
    this.errorMessage.set(null);
    try {
      const draft = this.composeDraft();
      const result = await this.api.commit(draft);
      this.toast.success('Created with AI');
      this.state.close();
      void this.router.navigate(this.targetRouteFor(result.kind, result.id));
    } catch (err) {
      this.errorMessage.set(this.formatError(err, 'Could not create from this draft.'));
      this.mode.set('preview');
    }
  }

  private targetRouteFor(kind: AiGeneratorDraft['kind'], id: string): unknown[] {
    if (kind === 'doc') return ['/docs', id];
    if (kind === 'project') return ['/projects', id];
    return ['/tasks', id];
  }

  protected restart(): void {
    this._draftKind.set(null);
    this.errorMessage.set(null);
    this.mode.set('idle');
  }

  protected close(): void {
    this.state.close();
  }

  protected updateSubtask(index: number, title: string): void {
    this.subtasks.update((list) => {
      const next = list.slice();
      next[index] = { ...next[index], title };
      return next;
    });
  }

  protected removeSubtask(index: number): void {
    this.subtasks.update((list) => list.filter((_, i) => i !== index));
  }

  private applyDraft(draft: AiGeneratorDraft): void {
    this._draftKind.set(draft.kind);
    if (draft.kind === 'task') {
      this.taskTitle.set(draft.title);
      this.taskDescription.set(draft.description ?? '');
      this.taskPriority.set(draft.priority ?? null);
      this.taskProjectId.set(draft.projectId ?? this.selectedProjectId());
      return;
    }
    if (draft.kind === 'task_with_subtasks') {
      this.parentTitle.set(draft.parent.title);
      this.parentDescription.set(draft.parent.description ?? '');
      this.parentPriority.set(draft.parent.priority ?? null);
      this.parentProjectId.set(draft.projectId ?? this.selectedProjectId());
      this.subtasks.set(
        draft.subtasks.map((s) => ({ title: s.title, description: s.description ?? null })),
      );
      return;
    }
    if (draft.kind === 'doc') {
      this.docTitle.set(draft.title);
      this.docIcon.set(draft.icon ?? null);
      this.docBody.set(draft.body ?? '');
      this.docProjectId.set(draft.projectId ?? this.selectedProjectId());
      return;
    }
    // project
    this.projectName.set(draft.name);
    this.projectKey.set(draft.key);
    this.projectDescription.set(draft.description ?? '');
    this.projectIcon.set(draft.icon ?? null);
    this.projectColor.set(draft.color ?? null);
  }

  private composeDraft(): AiGeneratorDraft {
    if (this._draftKind() === 'task') {
      const taskDraft: AiTaskDraft = {
        kind: 'task',
        title: this.taskTitle().trim(),
        description: this.taskDescription().trim() || null,
        priority: this.taskPriority(),
        projectId: this.taskProjectId(),
        labels: [],
      };
      return taskDraft;
    }
    if (this._draftKind() === 'task_with_subtasks') {
      const withSubtasks: AiTaskWithSubtasksDraft = {
        kind: 'task_with_subtasks',
        projectId: this.parentProjectId(),
        parent: {
          title: this.parentTitle().trim(),
          description: this.parentDescription().trim() || null,
          priority: this.parentPriority(),
          labels: [],
        },
        subtasks: this.subtasks()
          .filter((s) => s.title.trim().length > 0)
          .map((s) => ({
            title: s.title.trim(),
            description: (s.description ?? '').trim() || null,
          })),
      };
      return withSubtasks;
    }
    if (this._draftKind() === 'doc') {
      const docDraft: AiDocDraft = {
        kind: 'doc',
        title: this.docTitle().trim(),
        icon: this.docIcon(),
        body: this.docBody().trim() || null,
        projectId: this.docProjectId(),
      };
      return docDraft;
    }
    const projectDraft: AiProjectDraft = {
      kind: 'project',
      name: this.projectName().trim(),
      key: this.projectKey().trim().toUpperCase(),
      description: this.projectDescription().trim() || null,
      icon: this.projectIcon(),
      color: this.projectColor(),
    };
    return projectDraft;
  }

  private resetState(): void {
    this.mode.set('idle');
    this.prompt.set('');
    this.errorMessage.set(null);
    this.selectedProjectId.set(null);
    this._draftKind.set(null);
    this.taskTitle.set('');
    this.taskDescription.set('');
    this.taskPriority.set(null);
    this.taskProjectId.set(null);
    this.parentTitle.set('');
    this.parentDescription.set('');
    this.parentPriority.set(null);
    this.parentProjectId.set(null);
    this.subtasks.set([]);
    this.docTitle.set('');
    this.docIcon.set(null);
    this.docBody.set('');
    this.docProjectId.set(null);
    this.projectName.set('');
    this.projectKey.set('');
    this.projectDescription.set('');
    this.projectIcon.set(null);
    this.projectColor.set(null);
  }

  private formatError(err: unknown, fallback: string): string {
    if (typeof err === 'object' && err !== null && 'error' in err) {
      const inner = (err as { error?: { message?: string } }).error;
      if (inner?.message) return inner.message;
    }
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  }
}
