import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { SelectModule } from 'primeng/select';
import { TaskApiService, Task, TaskType } from '../../../stores/task-api.service';
import { TaskStore } from '../../../stores/task.store';
import { WorkflowStatusStore } from '../../../stores/workflow-status.store';
import { LabelStore } from '../../../stores/label.store';
import { ProjectMemberStore } from '../../../stores/project-member.store';
import { PlanningApiService, PlanningItem } from '../../../stores/planning-api.service';
import { ToastService } from '../../../core/toast/toast.service';

@Component({
  selector: 'jt-create-task',
  host: { class: 'block h-full w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TabsModule, SelectModule],
  styles: [`
    /* Form controls — consistent hover/focus across selects, inputs, dates, textareas. */
    .jt-input,
    .jt-select {
      width: 100%;
      border-radius: 0.75rem;
      border: 1px solid #e2e8f0; /* slate-200 */
      background-color: #ffffff;
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
      color: #0f172a; /* slate-900 */
      transition: border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
      outline: none;
    }
    .jt-input::placeholder {
      color: #94a3b8; /* slate-400 */
    }
    .jt-input:hover,
    .jt-select:hover {
      border-color: #cbd5e1; /* slate-300 */
      background-color: #f8fafc; /* slate-50 — tiny hint */
    }
    .jt-select { cursor: pointer; }
    .jt-input:focus,
    .jt-select:focus,
    .jt-input:focus-visible,
    .jt-select:focus-visible {
      border-color: #8b5cf6; /* violet-500 */
      background-color: #ffffff;
      box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.12);
    }
    .jt-input:disabled,
    .jt-select:disabled {
      background-color: #f1f5f9;
      color: #94a3b8;
      cursor: not-allowed;
    }

    /* Checkbox list rows — slate-50 list bg, violet-50 hover so it's actually visible. */
    .jt-pick-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-radius: 0.5rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      color: #334155; /* slate-700 */
      transition: background-color 120ms ease, color 120ms ease;
      cursor: pointer;
    }
    .jt-pick-row:hover {
      background-color: #f5f3ff; /* violet-50 */
      color: #4c1d95; /* violet-900 */
    }
    .jt-pick-row input[type='checkbox'] {
      accent-color: #7c3aed; /* violet-600 */
      width: 1rem;
      height: 1rem;
      cursor: pointer;
    }

    /* Tabs — override PrimeNG Aura defaults that render hover as near-transparent
       on a white surface (which the user reports as "white on white"). */
    :host ::ng-deep .jitre-editor .p-tablist {
      background: #ffffff !important;
      border-bottom: 1px solid #e2e8f0 !important;
    }
    :host ::ng-deep .jitre-editor .p-tab {
      background: transparent !important;
      color: #64748b !important; /* slate-500 */
      font-weight: 700 !important;
      padding: 0.85rem 1.1rem !important;
      transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease !important;
    }
    :host ::ng-deep .jitre-editor .p-tab:not(.p-tab-active):hover {
      background: #f5f3ff !important; /* violet-50 */
      color: #4c1d95 !important; /* violet-900 */
    }
    :host ::ng-deep .jitre-editor .p-tab-active {
      color: #6d28d9 !important; /* violet-700 */
      box-shadow: inset 0 -2px 0 0 #7c3aed !important; /* violet-600 indicator */
    }
    :host ::ng-deep .jitre-editor .p-tabpanels {
      background: transparent !important;
      padding: 0 !important;
    }
  `],
  template: `
    <div class="jitre-editor h-full w-full overflow-hidden bg-white">
      <header
        class="m-5 rounded-xl border border-slate-200 bg-gradient-to-r from-violet-50 via-white to-white p-5 shadow-sm"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <span
              class="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/25"
            >
              <i class="pi pi-check-square text-lg" aria-hidden="true"></i>
            </span>
            <div>
              <h2 class="text-xl font-black text-slate-950">Crear issue</h2>
              <p class="text-sm text-slate-500">Organizá el trabajo con ownership, sprint y entrega.</p>
            </div>
          </div>
          <button
            type="button"
            (click)="cancelled.emit()"
            class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Cerrar"
          >
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <form
        [formGroup]="form"
        (ngSubmit)="submit()"
        class="h-[calc(100%_-_7.75rem)] overflow-auto px-5 pb-5"
        novalidate
      >
        <p-tabs value="details" [showNavigators]="false">
          <p-tablist>
            <p-tab value="details"><i class="pi pi-file-edit mr-2" aria-hidden="true"></i>Detalles</p-tab>
            <p-tab value="planning"><i class="pi pi-calendar mr-2" aria-hidden="true"></i>Planificación</p-tab>
            <p-tab value="people"><i class="pi pi-users mr-2" aria-hidden="true"></i>Asignaciones</p-tab>
            <p-tab value="fields"><i class="pi pi-sliders-h mr-2" aria-hidden="true"></i>Campos</p-tab>
          </p-tablist>

          <p-tabpanels>
            <!-- TAB: Detalles -->
            <p-tabpanel value="details">
              <div class="grid gap-5 py-5 lg:grid-cols-[1.1fr_.9fr]">
                <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div class="flex items-center gap-3 border-b border-slate-100 p-5">
                    <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                      <i class="pi pi-pencil" aria-hidden="true"></i>
                    </span>
                    <div>
                      <h3 class="text-sm font-black text-slate-950">Identificación</h3>
                      <p class="text-xs text-slate-500">Título y alcance del issue</p>
                    </div>
                  </div>
                  <div class="space-y-4 p-5">
                    <div>
                      <label for="task-title" class="mb-2 block text-xs font-semibold text-slate-600">
                        Título <span class="text-rose-500">*</span>
                      </label>
                      <input
                        id="task-title"
                        type="text"
                        formControlName="title"
                        class="jt-input font-semibold"
                        placeholder="Implementar exportación de facturación"
                      />
                    </div>
                    <div>
                      <label for="task-desc" class="mb-2 block text-xs font-semibold text-slate-600">
                        Descripción
                      </label>
                      <textarea
                        id="task-desc"
                        formControlName="description"
                        rows="8"
                        class="jt-input resize-y"
                        placeholder="Contexto, criterios de aceptación y notas técnicas..."
                      ></textarea>
                    </div>
                  </div>
                </section>

                <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div class="flex items-center gap-3 border-b border-slate-100 p-5">
                    <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <i class="pi pi-sitemap" aria-hidden="true"></i>
                    </span>
                    <div>
                      <h3 class="text-sm font-black text-slate-950">Workflow</h3>
                      <p class="text-xs text-slate-500">Tipo, estado y prioridad</p>
                    </div>
                  </div>
                  <div class="grid gap-4 p-5 sm:grid-cols-2">
                    <div>
                      <label for="task-type" class="mb-2 block text-xs font-semibold text-slate-600">Tipo</label>
                      <p-select inputId="task-type" formControlName="type" [options]="typeSelectOptions" optionLabel="label" optionValue="value" appendTo="body" styleClass="w-full" />
                    </div>
                    <div>
                      <label for="task-status" class="mb-2 block text-xs font-semibold text-slate-600">Estado</label>
                      <p-select inputId="task-status" formControlName="statusId" [options]="statusSelectOptions()" optionLabel="label" optionValue="value" appendTo="body" styleClass="w-full" />
                    </div>
                    <div>
                      <label for="task-priority" class="mb-2 block text-xs font-semibold text-slate-600">Prioridad</label>
                      <p-select inputId="task-priority" formControlName="priority" [options]="prioritySelectOptions" optionLabel="label" optionValue="value" appendTo="body" styleClass="w-full" />
                    </div>
                    <div>
                      <label for="task-parent" class="mb-2 block text-xs font-semibold text-slate-600">Parent</label>
                      <p-select inputId="task-parent" formControlName="parentTaskId" [options]="parentTaskSelectOptions()" optionLabel="label" optionValue="value" placeholder="Sin parent" [showClear]="true" appendTo="body" styleClass="w-full" />
                    </div>
                  </div>
                </section>
              </div>
            </p-tabpanel>

            <!-- TAB: Planificación -->
            <p-tabpanel value="planning">
              <div class="grid gap-5 py-5 lg:grid-cols-2">
                <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div class="flex items-center gap-3 border-b border-slate-100 p-5">
                    <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <i class="pi pi-calendar" aria-hidden="true"></i>
                    </span>
                    <div>
                      <h3 class="text-sm font-black text-slate-950">Fechas y estimación</h3>
                      <p class="text-xs text-slate-500">Ventana de ejecución</p>
                    </div>
                  </div>
                  <div class="grid gap-4 p-5 sm:grid-cols-2">
                    <div>
                      <label for="task-start" class="mb-2 block text-xs font-semibold text-slate-600">Inicio</label>
                      <input id="task-start" type="date" formControlName="startDate" class="jt-input" />
                    </div>
                    <div>
                      <label for="task-due" class="mb-2 block text-xs font-semibold text-slate-600">Vencimiento</label>
                      <input id="task-due" type="date" formControlName="dueDate" class="jt-input" />
                    </div>
                    <div class="sm:col-span-2">
                      <label for="task-estimate" class="mb-2 block text-xs font-semibold text-slate-600">
                        Horas estimadas
                      </label>
                      <input
                        id="task-estimate"
                        type="number"
                        min="0"
                        step="0.25"
                        formControlName="estimatedHours"
                        class="jt-input"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </section>

                <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div class="flex items-center gap-3 border-b border-slate-100 p-5">
                    <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                      <i class="pi pi-flag" aria-hidden="true"></i>
                    </span>
                    <div>
                      <h3 class="text-sm font-black text-slate-950">Entrega</h3>
                      <p class="text-xs text-slate-500">Épica, sprint y release</p>
                    </div>
                  </div>
                  <div class="space-y-4 p-5">
                    <div>
                      <label for="task-epic" class="mb-2 block text-xs font-semibold text-slate-600">Épica</label>
                      <p-select inputId="task-epic" formControlName="epicId" [options]="epicSelectOptions()" optionLabel="label" optionValue="value" placeholder="Sin épica" [showClear]="true" appendTo="body" styleClass="w-full" />
                    </div>
                    <div>
                      <label for="task-sprint" class="mb-2 block text-xs font-semibold text-slate-600">Sprint</label>
                      <p-select inputId="task-sprint" formControlName="sprintId" [options]="sprintSelectOptions()" optionLabel="label" optionValue="value" placeholder="Backlog" [showClear]="true" appendTo="body" styleClass="w-full" />
                    </div>
                    <div>
                      <label for="task-release" class="mb-2 block text-xs font-semibold text-slate-600">Release</label>
                      <p-select inputId="task-release" formControlName="releaseId" [options]="releaseSelectOptions()" optionLabel="label" optionValue="value" placeholder="Sin release" [showClear]="true" appendTo="body" styleClass="w-full" />
                    </div>
                  </div>
                </section>
              </div>
            </p-tabpanel>

            <!-- TAB: Asignaciones -->
            <p-tabpanel value="people">
              <div class="grid gap-5 py-5 lg:grid-cols-2">
                <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 class="mb-4 text-sm font-black text-slate-950">Asignados</h3>
                  <div class="min-h-32 space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-2">
                    @for (member of memberOptions(); track member.userId) {
                      <label class="jt-pick-row">
                        <input
                          type="checkbox"
                          [checked]="isSelected('assigneeUserIds', member.userId)"
                          (change)="toggleArrayValue('assigneeUserIds', member.userId, $event)"
                        />
                        <span class="min-w-0">
                          <strong class="block truncate font-semibold text-slate-900">
                            {{ member.displayName || member.email || member.userId }}
                          </strong>
                          <span class="block text-xs text-slate-500">{{ member.role }}</span>
                        </span>
                      </label>
                    } @empty {
                      <p class="p-3 text-sm text-slate-400">No hay miembros cargados.</p>
                    }
                  </div>
                </section>

                <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 class="mb-4 text-sm font-black text-slate-950">Etiquetas</h3>
                  <div class="min-h-32 space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-2">
                    @for (label of labelOptions(); track label.id) {
                      <label class="jt-pick-row">
                        <input
                          type="checkbox"
                          [checked]="isSelected('labelIds', label.id)"
                          (change)="toggleArrayValue('labelIds', label.id, $event)"
                        />
                        <span
                          class="h-2.5 w-2.5 shrink-0 rounded-full"
                          [style.background]="label.color ?? '#6d28d9'"
                          aria-hidden="true"
                        ></span>
                        <span class="truncate">{{ label.name }}</span>
                      </label>
                    } @empty {
                      <p class="p-3 text-sm text-slate-400">No hay etiquetas.</p>
                    }
                  </div>
                </section>
              </div>
            </p-tabpanel>

            <!-- TAB: Campos -->
            <p-tabpanel value="fields">
              <section class="my-5 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 class="text-sm font-black text-slate-950">Campos personalizados</h3>
                <p class="mb-4 text-xs text-slate-500">Datos avanzados en formato JSON</p>
                <textarea
                  formControlName="customFieldsJson"
                  rows="7"
                  class="jt-input font-mono text-xs"
                  placeholder='{"severity":"high","component":"billing"}'
                ></textarea>
              </section>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>

        <footer
          class="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white/95 py-5 backdrop-blur"
        >
          <button
            type="button"
            (click)="cancelled.emit()"
            class="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            [disabled]="form.invalid || loading() || !defaultStatusId()"
            class="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ loading() ? 'Creando…' : 'Crear issue' }}
          </button>
        </footer>
      </form>
    </div>
  `,
})
export class CreateTaskComponent implements OnInit {
  readonly projectId = input.required<string>();
  readonly preselectedStatusId = input<string | null>(null);

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(TaskApiService);
  private readonly store = inject(TaskStore);
  private readonly statusStore = inject(WorkflowStatusStore);
  private readonly labelStore = inject(LabelStore);
  private readonly memberStore = inject(ProjectMemberStore);
  private readonly planningApi = inject(PlanningApiService);
  private readonly toast = inject(ToastService);

  readonly created = output<Task>();
  readonly cancelled = output<void>();
  readonly loading = signal(false);
  readonly planningItems = signal<PlanningItem[]>([]);

  readonly typeOptions: TaskType[] = ['task', 'bug', 'incident', 'feature'];
  readonly priorityOptions = ['none', 'low', 'medium', 'high', 'urgent'] as const;

  readonly statusOptions = computed(() => this.statusStore.byProject(this.projectId())());
  readonly labelOptions = computed(() => this.labelStore.byProject(this.projectId())());
  readonly memberOptions = computed(() => this.memberStore.byProject(this.projectId())());
  readonly parentTaskOptions = computed(() =>
    this.store.byProject(this.projectId())().filter(task => !task.parentTaskId),
  );
  readonly epics = computed(() => this.planningItems().filter(item => item.type === 'epic'));
  readonly sprints = computed(() => this.planningItems().filter(item => item.type === 'sprint'));
  readonly releases = computed(() => this.planningItems().filter(item => item.type === 'release'));

  readonly typeSelectOptions = this.typeOptions.map(t => ({ label: t, value: t }));
  readonly prioritySelectOptions = this.priorityOptions.map(p => ({ label: p, value: p }));
  readonly statusSelectOptions = computed(() =>
    this.statusOptions().map(s => ({ label: s.name, value: s.id })),
  );
  readonly parentTaskSelectOptions = computed(() =>
    this.parentTaskOptions().map(t => ({ label: t.title, value: t.id })),
  );
  readonly epicSelectOptions = computed(() => this.epics().map(e => ({ label: e.name, value: e.id })));
  readonly sprintSelectOptions = computed(() => this.sprints().map(s => ({ label: s.name, value: s.id })));
  readonly releaseSelectOptions = computed(() => this.releases().map(r => ({ label: r.name, value: r.id })));

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(1)]],
    description: [''],
    statusId: ['', Validators.required],
    priority: this.fb.nonNullable.control<(typeof this.priorityOptions)[number]>('none'),
    type: this.fb.nonNullable.control<TaskType>('task'),
    parentTaskId: [''],
    startDate: [''],
    dueDate: [''],
    estimatedHours: this.fb.control<number | null>(null),
    epicId: [''],
    sprintId: [''],
    releaseId: [''],
    assigneeUserIds: this.fb.nonNullable.control<string[]>([]),
    labelIds: this.fb.nonNullable.control<string[]>([]),
    customFieldsJson: [''],
  });

  readonly defaultStatusId = computed<string | null>(() => {
    const preselected = this.preselectedStatusId();
    if (preselected) return preselected;
    const list = this.statusStore.byProject(this.projectId())();
    if (list.length === 0) return null;
    const def = list.find(s => s.isDefault);
    return (def ?? list[0]).id;
  });

  async ngOnInit(): Promise<void> {
    if (this.defaultStatusId() === null) {
      try {
        await this.statusStore.loadForProject(this.projectId());
      } catch {
        // Allow retry through parent refresh.
      }
    }
    await Promise.allSettled([
      this.labelStore.loadForProject(this.projectId()),
      this.memberStore.loadForProject(this.projectId()),
      this.store.loadForProject(this.projectId()),
      this.planningApi.list(this.projectId()).then(items => this.planningItems.set(items)),
    ]);
    this.form.controls.statusId.setValue(this.defaultStatusId() ?? '');
  }

  isSelected(controlName: 'assigneeUserIds' | 'labelIds', value: string): boolean {
    return this.form.controls[controlName].value.includes(value);
  }

  toggleArrayValue(controlName: 'assigneeUserIds' | 'labelIds', value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.form.controls[controlName].value;
    const next = checked ? [...new Set([...current, value])] : current.filter(v => v !== value);
    this.form.controls[controlName].setValue(next);
  }

  async submit(): Promise<void> {
    const projectId = this.projectId();
    const statusId = this.form.controls.statusId.value || this.defaultStatusId();
    if (this.form.invalid || !projectId || !statusId) return;
    this.loading.set(true);
    try {
      const {
        title,
        description,
        type,
        priority,
        parentTaskId,
        startDate,
        dueDate,
        estimatedHours,
        epicId,
        sprintId,
        releaseId,
        assigneeUserIds,
        labelIds,
        customFieldsJson,
      } = this.form.getRawValue();
      const customFields = this.parseCustomFields(customFieldsJson);
      if (customFields === null) {
        this.toast.error('Custom fields must be a valid JSON object');
        return;
      }
      const task = await this.api.create(projectId, {
        title: title!.trim(),
        statusId,
        type: type ?? 'task',
        priority,
        ...(description ? { description } : {}),
        ...(parentTaskId ? { parentTaskId } : {}),
        ...(startDate ? { startDate } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(estimatedHours !== null && estimatedHours !== undefined ? { estimatedHours } : {}),
        ...(epicId ? { epicId } : {}),
        ...(sprintId ? { sprintId } : {}),
        ...(releaseId ? { releaseId } : {}),
        ...(assigneeUserIds.length > 0 ? { assigneeUserIds } : {}),
        ...(labelIds.length > 0 ? { labelIds } : {}),
        ...(customFields ? { customFields } : {}),
      });
      this.store.upsert(task);
      this.toast.success('Task created');
      this.created.emit(task);
      this.form.reset({
        title: '',
        description: '',
        statusId: this.defaultStatusId() ?? '',
        priority: 'none',
        type: 'task',
        parentTaskId: '',
        startDate: '',
        dueDate: '',
        estimatedHours: null,
        epicId: '',
        sprintId: '',
        releaseId: '',
        assigneeUserIds: [],
        labelIds: [],
        customFieldsJson: '',
      });
    } catch {
      this.toast.error('Failed to create task');
    } finally {
      this.loading.set(false);
    }
  }

  private parseCustomFields(value: string | null | undefined): Record<string, unknown> | undefined | null {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}
