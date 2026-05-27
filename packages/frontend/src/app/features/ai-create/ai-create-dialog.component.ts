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
import { SelectModule } from 'primeng/select';
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

interface SelectOption<T> {
  label: string;
  value: T;
}

const PRIORITIES: SelectOption<TaskPriority | null>[] = [
  { value: null, label: '— Sin prioridad' },
  { value: TaskPriority.LOW, label: 'Low' },
  { value: TaskPriority.MEDIUM, label: 'Medium' },
  { value: TaskPriority.HIGH, label: 'High' },
  { value: TaskPriority.URGENT, label: 'Urgent' },
];

const MAX_PROMPT_CHARS = 2000;
const MIN_PROMPT_CHARS = 3;

@Component({
  selector: 'jt-ai-create-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule],
  styles: [`
    :host ::ng-deep .p-select {
      width: 100%;
      background: #ffffff;
      border-radius: 0.75rem;
    }
    :host ::ng-deep .p-select.p-select-sm {
      font-size: 0.75rem;
    }
    :host ::ng-deep .p-select:not(.p-disabled):hover {
      border-color: #c4b5fd; /* violet-300 */
    }
    :host ::ng-deep .p-select:not(.p-disabled).p-focus {
      border-color: #8b5cf6; /* violet-500 */
      box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.12);
    }
  `],
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
                Crear con IA desde un prompt
              </h2>
              <p class="text-sm text-slate-500">
                Describí lo que necesitás. La IA propone un borrador que podés editar antes de guardar.
              </p>
            </div>
            <button
              type="button"
              (click)="close()"
              class="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Cerrar"
            >
              <i class="pi pi-times text-xs" aria-hidden="true"></i>
            </button>
          </header>

          @if (mode() === 'idle' || mode() === 'loading') {
            <label class="block">
              <span class="mb-1.5 flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Prompt <span class="text-rose-500">*</span>
                </span>
                <span
                  class="text-[11px] font-mono tabular-nums"
                  [class.text-slate-400]="!promptTooLong()"
                  [class.text-rose-600]="promptTooLong()"
                  [class.font-bold]="promptTooLong()"
                >
                  {{ promptLength() }}/{{ maxPromptChars }}
                </span>
              </span>
              <textarea
                #promptInput
                [(ngModel)]="prompt"
                rows="5"
                [disabled]="mode() === 'loading'"
                [maxlength]="maxPromptChars"
                placeholder="ej: 'Planificar el lanzamiento de la nueva página de pricing con 5 sub-pasos'"
                class="w-full resize-none rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-900
                       placeholder:text-slate-400 transition focus:bg-white focus:outline-none"
                [class.border-slate-200]="!promptTooLong()"
                [class.focus:border-violet-400]="!promptTooLong()"
                [class.border-rose-300]="promptTooLong()"
                [class.focus:border-rose-500]="promptTooLong()"
                (keydown.meta.enter)="generate()"
                (keydown.control.enter)="generate()"
              ></textarea>
            </label>

            <div class="mt-4">
              <label for="ai-project-select" class="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Proyecto <span class="text-rose-500">*</span>
              </label>
              <p-select
                inputId="ai-project-select"
                [options]="projectOptions()"
                [(ngModel)]="selectedProjectId"
                optionLabel="label"
                optionValue="value"
                placeholder="Elegí un proyecto…"
                [disabled]="mode() === 'loading'"
                [showClear]="false"
                appendTo="body"
              />
              <p class="mt-1.5 text-[11px] text-slate-500">
                El proyecto da contexto a la IA: estados, miembros, planning. Es obligatorio.
              </p>
            </div>

            @if (errorMessage()) {
              <div class="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                <p class="font-semibold">{{ errorMessage() }}</p>
                @if (errorFields().length > 0) {
                  <ul class="mt-1 list-disc pl-5 text-xs">
                    @for (e of errorFields(); track e.field) {
                      <li><strong class="font-mono">{{ e.field }}</strong>: {{ e.message }}</li>
                    }
                  </ul>
                }
              </div>
            }

            <div class="mt-5 flex items-center justify-between gap-3">
              <p class="text-[11px] text-slate-400 min-h-[1rem]">
                @if (disabledReason(); as reason) {
                  <i class="pi pi-info-circle text-[10px] mr-1" aria-hidden="true"></i>{{ reason }}
                }
              </p>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="close()"
                  class="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  (click)="generate()"
                  [disabled]="!canGenerate()"
                  [attr.title]="disabledReason()"
                  class="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white
                         transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  @if (mode() === 'loading') {
                    <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>
                    Generando…
                  } @else {
                    <i class="pi pi-sparkles text-xs" aria-hidden="true"></i>
                    Generar borrador
                  }
                </button>
              </div>
            </div>
          }

          @if (mode() === 'preview' || mode() === 'committing') {
            @if (draftKind() === 'task') {
              <section class="space-y-3" aria-label="Task draft">
                <p class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">
                  <i class="pi pi-check-square text-[9px]" aria-hidden="true"></i>
                  Borrador de tarea
                </p>
                <label class="block">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Título</span>
                  <input
                    type="text"
                    [ngModel]="taskTitle()"
                    (ngModelChange)="taskTitle.set($event)"
                    class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  />
                </label>
                <label class="block">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Descripción</span>
                  <textarea
                    rows="3"
                    [ngModel]="taskDescription()"
                    (ngModelChange)="taskDescription.set($event)"
                    class="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  ></textarea>
                </label>
                <div class="flex flex-wrap items-end gap-3">
                  <div class="flex-1 min-w-[10rem]">
                    <span class="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-1">Prioridad</span>
                    <p-select
                      [options]="priorities"
                      [ngModel]="taskPriority()"
                      (ngModelChange)="taskPriority.set($event)"
                      optionLabel="label"
                      optionValue="value"
                      appendTo="body"
                      size="small"
                    />
                  </div>
                  <div class="flex-1 min-w-[12rem]">
                    <span class="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-1">Proyecto</span>
                    <p-select
                      [options]="projectOptions()"
                      [ngModel]="taskProjectId()"
                      (ngModelChange)="taskProjectId.set($event)"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Sin proyecto"
                      appendTo="body"
                      size="small"
                    />
                  </div>
                </div>
              </section>
            }

            @if (draftKind() === 'task_with_subtasks') {
              <section class="space-y-3" aria-label="Task with subtasks draft">
                <p class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">
                  <i class="pi pi-sitemap text-[9px]" aria-hidden="true"></i>
                  Borrador: tarea + sub-tareas
                </p>
                <label class="block">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Título principal</span>
                  <input
                    type="text"
                    [ngModel]="parentTitle()"
                    (ngModelChange)="parentTitle.set($event)"
                    class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  />
                </label>
                <label class="block">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Descripción principal</span>
                  <textarea
                    rows="2"
                    [ngModel]="parentDescription()"
                    (ngModelChange)="parentDescription.set($event)"
                    class="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  ></textarea>
                </label>
                <div class="flex flex-wrap items-end gap-3">
                  <div class="flex-1 min-w-[10rem]">
                    <span class="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-1">Prioridad</span>
                    <p-select
                      [options]="priorities"
                      [ngModel]="parentPriority()"
                      (ngModelChange)="parentPriority.set($event)"
                      optionLabel="label"
                      optionValue="value"
                      appendTo="body"
                      size="small"
                    />
                  </div>
                  <div class="flex-1 min-w-[12rem]">
                    <span class="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-1">Proyecto</span>
                    <p-select
                      [options]="projectOptions()"
                      [ngModel]="parentProjectId()"
                      (ngModelChange)="parentProjectId.set($event)"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Sin proyecto"
                      appendTo="body"
                      size="small"
                    />
                  </div>
                </div>

                <div>
                  <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">
                    Sub-tareas ({{ subtasks().length }})
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
                          [attr.aria-label]="'Quitar sub-tarea ' + ($index + 1)"
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
                  Borrador de documento
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
                    aria-label="Icono del documento"
                  />
                  <input
                    type="text"
                    [ngModel]="docTitle()"
                    (ngModelChange)="docTitle.set($event)"
                    placeholder="Título de la página"
                    class="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  />
                </div>
                <label class="block">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Contenido</span>
                  <textarea
                    rows="5"
                    [ngModel]="docBody()"
                    (ngModelChange)="docBody.set($event)"
                    class="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  ></textarea>
                </label>
                <div>
                  <span class="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-1">Proyecto</span>
                  <p-select
                    [options]="projectOptionsWithWorkspace()"
                    [ngModel]="docProjectId()"
                    (ngModelChange)="docProjectId.set($event)"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Workspace (sin proyecto)"
                    appendTo="body"
                    size="small"
                  />
                </div>
              </section>
            }

            @if (draftKind() === 'project') {
              <section class="space-y-3" aria-label="Project draft">
                <p class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">
                  <i class="pi pi-briefcase text-[9px]" aria-hidden="true"></i>
                  Borrador de proyecto
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
                    aria-label="Icono del proyecto"
                  />
                  <input
                    type="text"
                    [ngModel]="projectName()"
                    (ngModelChange)="projectName.set($event)"
                    placeholder="Nombre del proyecto"
                    class="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           focus:border-violet-400 focus:outline-none"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <label class="flex items-center gap-2 text-xs text-slate-600">
                    Clave
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
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Descripción</span>
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
              <div class="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                <p class="font-semibold">{{ errorMessage() }}</p>
                @if (errorFields().length > 0) {
                  <ul class="mt-1 list-disc pl-5 text-xs">
                    @for (e of errorFields(); track e.field) {
                      <li><strong class="font-mono">{{ e.field }}</strong>: {{ e.message }}</li>
                    }
                  </ul>
                }
              </div>
            }

            <div class="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                (click)="restart()"
                [disabled]="mode() === 'committing'"
                class="rounded-full px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <i class="pi pi-refresh text-[10px] mr-1" aria-hidden="true"></i>
                Volver a generar
              </button>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="close()"
                  [disabled]="mode() === 'committing'"
                  class="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Descartar
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
                    Creando…
                  } @else {
                    <i class="pi pi-check text-xs" aria-hidden="true"></i>
                    Crear
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
  protected readonly errorFields = signal<Array<{ field: string; message: string }>>([]);
  protected readonly selectedProjectId = signal<string | null>(null);

  protected readonly priorities = PRIORITIES;
  protected readonly maxPromptChars = MAX_PROMPT_CHARS;
  protected readonly projects = computed(() => this.projectStore.items());

  protected readonly projectOptions = computed<SelectOption<string | null>[]>(() =>
    this.projects().map((p) => ({ label: p.name, value: p.id })),
  );

  protected readonly projectOptionsWithWorkspace = computed<SelectOption<string | null>[]>(() => [
    { label: 'Workspace (sin proyecto)', value: null },
    ...this.projects().map((p) => ({ label: p.name, value: p.id })),
  ]);

  protected readonly promptLength = computed(() => this.prompt().length);
  protected readonly promptTooLong = computed(() => this.prompt().length > MAX_PROMPT_CHARS);

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

  /**
   * Single source of truth for what's blocking the user from generating.
   * Returns null when everything is OK, otherwise a human message explaining
   * why the button is disabled — surfaced inline AND as the `title` tooltip.
   */
  protected readonly disabledReason = computed<string | null>(() => {
    if (this.mode() === 'loading') return null;
    const len = this.prompt().trim().length;
    if (len === 0) return 'Escribí un prompt para continuar.';
    if (len < MIN_PROMPT_CHARS) return `El prompt necesita al menos ${MIN_PROMPT_CHARS} caracteres.`;
    if (this.prompt().length > MAX_PROMPT_CHARS) {
      return `El prompt no puede superar ${MAX_PROMPT_CHARS} caracteres.`;
    }
    if (!this.selectedProjectId()) return 'Elegí un proyecto para dar contexto a la IA.';
    return null;
  });

  protected readonly canGenerate = computed(
    () => this.mode() === 'idle' && this.disabledReason() === null,
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
    this.clearError();
    try {
      const response = await this.api.draft({
        prompt: this.prompt(),
        context: this.selectedProjectId() ? { projectId: this.selectedProjectId()! } : undefined,
      });
      const draft = response.drafts[0];
      if (!draft) {
        throw new Error('La IA no devolvió ningún borrador.');
      }
      this.applyDraft(draft);
      this.mode.set('preview');
    } catch (err) {
      this.surfaceError(err, 'No pudimos generar el borrador.');
      this.mode.set('idle');
    }
  }

  protected async commit(): Promise<void> {
    if (!this.canCommit()) return;
    this.mode.set('committing');
    this.clearError();
    try {
      const draft = this.composeDraft();
      const result = await this.api.commit(draft);
      this.toast.success('Creado con IA');
      this.state.close();
      void this.router.navigate(this.targetRouteFor(result.kind, result.id));
    } catch (err) {
      this.surfaceError(err, 'No pudimos crear desde este borrador.');
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
    this.clearError();
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
    this.clearError();
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

  private clearError(): void {
    this.errorMessage.set(null);
    this.errorFields.set([]);
  }

  /**
   * Extract a user-friendly message from an HTTP error.
   *
   * Backend uses RFC 9457 Problem Details: `{ status, title, detail, errors? }`.
   * `detail` is the human sentence; `errors` is a `{ field: string[] }` map of
   * field-level violations. We surface both: the headline message + a bullet
   * list of field issues. Also pipes the message to the toast so it's visible
   * even if the dialog scrolled.
   */
  private surfaceError(err: unknown, fallback: string): void {
    const problem = this.extractProblemDetails(err);
    const message = problem?.detail ?? problem?.title ?? this.extractGenericMessage(err) ?? fallback;
    const fields = problem?.errors
      ? Object.entries(problem.errors).flatMap(([field, msgs]) =>
          (msgs as string[]).map((m) => ({ field, message: m })),
        )
      : [];
    this.errorMessage.set(message);
    this.errorFields.set(fields);
    this.toast.error(message);
  }

  private extractProblemDetails(err: unknown): {
    status?: number;
    title?: string;
    detail?: string;
    errors?: Record<string, string[]>;
  } | null {
    if (typeof err !== 'object' || err === null) return null;
    const candidate = (err as { error?: unknown }).error;
    if (typeof candidate !== 'object' || candidate === null) return null;
    return candidate as {
      status?: number;
      title?: string;
      detail?: string;
      errors?: Record<string, string[]>;
    };
  }

  private extractGenericMessage(err: unknown): string | null {
    if (err instanceof Error && err.message) return err.message;
    return null;
  }
}
