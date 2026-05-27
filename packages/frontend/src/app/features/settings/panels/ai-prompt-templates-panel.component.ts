import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  AiPromptOperation,
  AiPromptTemplate,
  AiPromptTemplateApiService,
} from '../../../stores/ai-prompt-template-api.service';
import { ToastService } from '../../../core/toast/toast.service';

interface OperationDef {
  value: AiPromptOperation;
  label: string;
  variables: string[];
}

const OPERATIONS: OperationDef[] = [
  {
    value: 'describe',
    label: 'Task description',
    variables: ['taskTitle', 'currentDescription', 'projectName', 'tone'],
  },
  {
    value: 'suggest_subtasks',
    label: 'Suggest subtasks',
    variables: ['taskTitle', 'taskDescription', 'maxSuggestions'],
  },
  {
    value: 'summary',
    label: 'Comments summary',
    variables: ['commentCount'],
  },
  {
    value: 'generate_draft',
    label: 'Generate from natural language',
    variables: ['userPrompt'],
  },
];

@Component({
  selector: 'jt-ai-prompt-templates-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectModule, TranslatePipe],
  template: `
    <section class="space-y-5">
      <header class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70 space-y-2">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-200 bg-violet-50">
          <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">{{ 'settings.aiPrompts.badge' | translate }}</span>
        </div>
        <h2 class="text-2xl font-black tracking-tight text-slate-950">{{ 'settings.aiPrompts.title' | translate }}</h2>
        <p class="text-sm text-slate-500 max-w-2xl">
          {{ 'settings.aiPrompts.description' | translate }}
        </p>
      </header>

      <!-- Tabs por operation -->
      <div class="flex flex-wrap gap-2">
        @for (op of operations; track op.value) {
          <button
            type="button"
            (click)="selectOperation(op.value)"
            [class]="
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition ' +
              (activeOperation() === op.value
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 border-indigo-500 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700')
            "
          >
            {{ operationLabelKey(op.value) | translate }}
            <span
              [class]="
                'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ' +
                (activeOperation() === op.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500')
              "
            >
              {{ countFor(op.value) }}
            </span>
          </button>
        }
      </div>

      <!-- List + editor -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
        <!-- List -->
        <aside class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/70">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {{ 'settings.aiPrompts.list.header' | translate }}
            </h3>
            <button
              type="button"
              (click)="startCreate()"
              class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-100"
            >
              <span class="pi pi-plus text-[10px]" aria-hidden="true"></span>
              {{ 'common.new' | translate }}
            </button>
          </div>
          @if (loading()) {
            <p class="px-3 py-2 text-xs italic text-slate-400">{{ 'common.loading' | translate }}</p>
          } @else {
            <ul class="space-y-1">
              @for (t of currentList(); track t.id) {
                <li>
                  <button
                    type="button"
                    (click)="select(t)"
                    [class]="
                      'w-full rounded-lg border px-3 py-2 text-left text-sm transition ' +
                      (selectedId() === t.id
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                        : 'border-transparent hover:border-slate-200 hover:bg-slate-50 text-slate-700')
                    "
                  >
                    <div class="flex items-center gap-2">
                      <span class="flex-1 truncate font-semibold">{{ t.name }}</span>
                      @if (t.isDefault) {
                        <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                          {{ 'common.default' | translate }}
                        </span>
                      }
                      @if (t.isBuiltin) {
                        <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                          {{ 'common.builtin' | translate }}
                        </span>
                      }
                    </div>
                    @if (t.description) {
                      <p class="mt-0.5 truncate text-[11px] text-slate-500">{{ t.description }}</p>
                    }
                  </button>
                </li>
              } @empty {
                <li class="px-3 py-2 text-xs italic text-slate-400">
                  {{ 'settings.aiPrompts.list.empty' | translate }}
                </li>
              }
            </ul>
          }
        </aside>

        <!-- Editor -->
        <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          @if (selected(); as t) {
            <form [formGroup]="form" (ngSubmit)="save()" class="space-y-4">
              <header class="flex flex-wrap items-baseline justify-between gap-2">
                <div class="flex items-center gap-2">
                  <h3 class="text-lg font-black text-slate-950">
                    {{ isNew() ? ('settings.aiPrompts.editor.newTitle' | translate) : t.name }}
                  </h3>
                  @if (t.isBuiltin && !isNew()) {
                    <span class="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {{ 'settings.aiPrompts.editor.readonlyBadge' | translate }}
                    </span>
                  }
                </div>
                <div class="flex items-center gap-2">
                  @if (!t.isDefault && !isNew()) {
                    <button
                      type="button"
                      (click)="makeDefault()"
                      class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      {{ 'settings.aiPrompts.editor.markAsDefault' | translate }}
                    </button>
                  }
                  @if (!t.isBuiltin && !isNew() && !t.isDefault) {
                    <button
                      type="button"
                      (click)="remove()"
                      class="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
                    >
                      {{ 'common.delete' | translate }}
                    </button>
                  }
                </div>
              </header>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-1">
                    {{ 'settings.aiPrompts.editor.name' | translate }}
                  </span>
                  <input
                    type="text"
                    formControlName="name"
                    [readonly]="t.isBuiltin && !isNew()"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 read-only:bg-slate-50"
                  />
                </label>
                <label class="block">
                  <span class="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-1">
                    {{ 'settings.aiPrompts.editor.operation' | translate }}
                  </span>
                  <input
                    type="text"
                    [value]="operationLabelText(t.operation)"
                    readonly
                    class="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  />
                </label>
              </div>

              <label class="block">
                <span class="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-1">
                  {{ 'settings.aiPrompts.editor.descriptionField' | translate }}
                </span>
                <input
                  type="text"
                  formControlName="description"
                  [placeholder]="'settings.aiPrompts.editor.descriptionPlaceholder' | translate"
                  [readonly]="t.isBuiltin && !isNew()"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 read-only:bg-slate-50"
                />
              </label>

              <label class="block">
                <span class="mb-1 flex items-center justify-between">
                  <span class="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {{ 'settings.aiPrompts.editor.systemPrompt' | translate }}
                  </span>
                  <span class="text-[10px] text-slate-400">
                    {{ 'settings.aiPrompts.editor.variablesHint' | translate }}
                    @for (v of variablesFor(t.operation); track v) {
                      <code class="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-700">{{ '{{' + v + '}}' }}</code>
                    }
                  </span>
                </span>
                <textarea
                  formControlName="systemPrompt"
                  rows="5"
                  [readonly]="t.isBuiltin && !isNew()"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[12.5px] text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 read-only:bg-slate-50"
                ></textarea>
              </label>

              <label class="block">
                <span class="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-1">
                  {{ 'settings.aiPrompts.editor.userTemplate' | translate }}
                </span>
                <textarea
                  formControlName="userTemplate"
                  rows="6"
                  [readonly]="t.isBuiltin && !isNew()"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[12.5px] text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 read-only:bg-slate-50"
                ></textarea>
              </label>

              @if (!t.isBuiltin || isNew()) {
                <div class="flex items-center justify-between pt-1">
                  <p class="text-[11px] text-slate-400">
                    {{ 'settings.aiPrompts.editor.tip' | translate: { example: '{{taskTitle}}' } }}
                  </p>
                  <button
                    type="submit"
                    [disabled]="form.invalid || saving()"
                    class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {{ saving()
                        ? ('common.saving' | translate)
                        : (isNew()
                            ? ('settings.aiPrompts.editor.submitCreate' | translate)
                            : ('settings.aiPrompts.editor.submitUpdate' | translate)) }}
                  </button>
                </div>
              }
            </form>
          } @else {
            <div class="flex h-full flex-col items-center justify-center gap-3 py-12 text-center text-sm text-slate-500">
              <span class="pi pi-sparkles text-3xl text-slate-300" aria-hidden="true"></span>
              <p>{{ 'settings.aiPrompts.editor.emptyState' | translate }}</p>
            </div>
          }
        </article>
      </div>
    </section>
  `,
})
export class AiPromptTemplatesPanelComponent implements OnInit {
  private readonly api = inject(AiPromptTemplateApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly t = inject(TranslateService);

  readonly operations = OPERATIONS;
  readonly activeOperation = signal<AiPromptOperation>('describe');
  readonly templates = signal<AiPromptTemplate[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly isNew = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    systemPrompt: ['', [Validators.required, Validators.minLength(10)]],
    userTemplate: ['', [Validators.required, Validators.minLength(10)]],
  });

  readonly currentList = computed<AiPromptTemplate[]>(() =>
    this.templates().filter((t) => t.operation === this.activeOperation()),
  );

  readonly selected = computed<AiPromptTemplate | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    if (id === '__new__') {
      return {
        id: '__new__',
        workspaceId: '',
        operation: this.activeOperation(),
        name: '',
        description: null,
        systemPrompt: '',
        userTemplate: '',
        variables: this.variablesFor(this.activeOperation()),
        isDefault: false,
        isBuiltin: false,
        createdByUserId: null,
        createdAt: '',
        updatedAt: '',
      };
    }
    return this.templates().find((t) => t.id === id) ?? null;
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  countFor(op: AiPromptOperation): number {
    return this.templates().filter((t) => t.operation === op).length;
  }

  operationLabel(op: AiPromptOperation): string {
    return OPERATIONS.find((o) => o.value === op)?.label ?? op;
  }

  operationLabelKey(op: AiPromptOperation): string {
    return `settings.aiPrompts.operations.${op}`;
  }

  operationLabelText(op: AiPromptOperation): string {
    return this.t.instant(this.operationLabelKey(op));
  }

  variablesFor(op: AiPromptOperation): string[] {
    return OPERATIONS.find((o) => o.value === op)?.variables ?? [];
  }

  selectOperation(op: AiPromptOperation): void {
    this.activeOperation.set(op);
    this.selectedId.set(null);
    this.isNew.set(false);
  }

  select(t: AiPromptTemplate): void {
    this.selectedId.set(t.id);
    this.isNew.set(false);
    this.form.reset({
      name: t.name,
      description: t.description ?? '',
      systemPrompt: t.systemPrompt,
      userTemplate: t.userTemplate,
    });
  }

  startCreate(): void {
    this.selectedId.set('__new__');
    this.isNew.set(true);
    this.form.reset({
      name: '',
      description: '',
      systemPrompt: '',
      userTemplate: '',
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const values = this.form.getRawValue();
      if (this.isNew()) {
        const created = await this.api.create({
          operation: this.activeOperation(),
          name: values.name,
          description: values.description || undefined,
          systemPrompt: values.systemPrompt,
          userTemplate: values.userTemplate,
          variables: this.variablesFor(this.activeOperation()),
        });
        this.templates.update((curr) => [...curr, created]);
        this.selectedId.set(created.id);
        this.isNew.set(false);
        this.toast.success(this.t.instant('settings.aiPrompts.editor.toasts.created'));
      } else {
        const id = this.selectedId();
        if (!id) return;
        const updated = await this.api.update(id, {
          name: values.name,
          description: values.description || undefined,
          systemPrompt: values.systemPrompt,
          userTemplate: values.userTemplate,
        });
        this.templates.update((curr) => curr.map((tpl) => (tpl.id === id ? updated : tpl)));
        this.toast.success(this.t.instant('settings.aiPrompts.editor.toasts.updated'));
      }
    } catch (err: unknown) {
      this.toast.error(
        this.errorMessage(err) ?? this.t.instant('settings.aiPrompts.editor.toasts.createFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async makeDefault(): Promise<void> {
    const id = this.selectedId();
    if (!id || id === '__new__') return;
    try {
      const updated = await this.api.setDefault(id);
      this.templates.update((curr) =>
        curr.map((t) => {
          if (t.operation !== updated.operation) return t;
          if (t.id === updated.id) return updated;
          return { ...t, isDefault: false };
        }),
      );
      this.toast.success(
        this.t.instant('settings.aiPrompts.editor.toasts.defaultSet', { name: updated.name }),
      );
    } catch (err: unknown) {
      this.toast.error(
        this.errorMessage(err) ?? this.t.instant('settings.aiPrompts.editor.toasts.defaultFailed'),
      );
    }
  }

  async remove(): Promise<void> {
    const id = this.selectedId();
    if (!id || id === '__new__') return;
    if (!confirm(this.t.instant('settings.aiPrompts.editor.deleteConfirm'))) return;
    try {
      await this.api.remove(id);
      this.templates.update((curr) => curr.filter((t) => t.id !== id));
      this.selectedId.set(null);
      this.toast.success(this.t.instant('settings.aiPrompts.editor.toasts.deleted'));
    } catch (err: unknown) {
      this.toast.error(
        this.errorMessage(err) ?? this.t.instant('settings.aiPrompts.editor.toasts.deleteFailed'),
      );
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.templates.set(await this.api.list());
    } catch {
      this.templates.set([]);
      this.toast.error(this.t.instant('settings.aiPrompts.editor.toasts.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  private errorMessage(err: unknown): string | null {
    const e = err as { error?: { message?: string | string[]; detail?: string } };
    if (!e?.error) return null;
    const m = e.error.message ?? e.error.detail;
    if (Array.isArray(m)) return m.join(', ');
    return m ?? null;
  }
}
