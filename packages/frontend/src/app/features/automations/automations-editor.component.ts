import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import {
  Automation,
  AutomationAction,
  AutomationActionType,
  AutomationApiService,
  AutomationTrigger,
  CreateAutomationBody,
} from '../../stores/automation-api.service';
import { WorkflowStatusStore } from '../../stores/workflow-status.store';
import { ProjectMemberStore } from '../../stores/project-member.store';
import { LabelStore } from '../../stores/label.store';
import { ToastService } from '../../core/toast/toast.service';

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  'task.created': 'Cuando se crea una tarea',
  'task.status_changed': 'Cuando cambia el estado',
  'task.assigned': 'Cuando se asigna',
  'task.priority_changed': 'Cuando cambia la prioridad',
  'task.due_soon': 'Cuando se acerca la fecha límite',
};

const ACTION_LABELS: Record<AutomationActionType, string> = {
  assign_to_user: 'Asignar a un usuario',
  set_priority: 'Setear prioridad',
  set_status: 'Cambiar estado',
  add_label: 'Agregar etiqueta',
  add_comment: 'Agregar comentario',
  notify_user: 'Notificar a un usuario',
};

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

/**
 * Per-project automations editor. Lives in the project settings tab next to
 * the workflow editor. Each rule = (trigger + actions[]), the conditions
 * field is left simple for now (no per-rule UI; the backend supports them
 * but exposing the full DSL deserves its own component).
 */
@Component({
  selector: 'jt-automations-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule],
  template: `
    <section class="space-y-4">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 class="text-lg font-bold text-slate-950">Automatizaciones</h3>
          <p class="text-xs text-slate-500">
            Reglas que disparan acciones automáticamente cuando algo ocurre en este proyecto.
          </p>
        </div>
        <button type="button" (click)="openForm()"
                class="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">
          <i class="pi pi-plus text-xs" aria-hidden="true"></i> Nueva regla
        </button>
      </header>

      <!-- Editor form -->
      @if (showForm()) {
        <form class="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-5"
              (ngSubmit)="save()">
          <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nombre</span>
              <input type="text" [(ngModel)]="form.name" name="name" required
                     class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" />
            </label>
            <label class="flex items-end gap-2 text-xs text-slate-700 pb-1">
              <input type="checkbox" [(ngModel)]="form.enabled" name="enabled" class="accent-violet-600" />
              Habilitada
            </label>
          </div>

          <label class="flex flex-col gap-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trigger</span>
            <p-select [(ngModel)]="form.trigger" name="trigger"
                      [options]="triggerOptions" optionLabel="label" optionValue="value"
                      appendTo="body" />
          </label>

          <div>
            <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Acciones ({{ form.actions.length }})
            </p>
            <ul class="space-y-2 rounded-xl border border-slate-200 bg-white p-2 max-h-64 overflow-auto">
              @for (action of form.actions; track $index) {
                <li class="grid grid-cols-[10rem_1fr_2rem] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                  <p-select [ngModel]="action.type"
                            (ngModelChange)="changeActionType($index, $event)"
                            [options]="actionOptions" optionLabel="label" optionValue="value"
                            appendTo="body" size="small" />
                  @switch (action.type) {
                    @case ('assign_to_user') {
                      <p-select [(ngModel)]="action.params['userId']" name="userId-{{ $index }}"
                                [options]="memberOptions()" optionLabel="label" optionValue="value"
                                placeholder="Elegir usuario" appendTo="body" size="small" />
                    }
                    @case ('notify_user') {
                      <p-select [(ngModel)]="action.params['userId']" name="userId-{{ $index }}"
                                [options]="memberOptions()" optionLabel="label" optionValue="value"
                                placeholder="Elegir usuario" appendTo="body" size="small" />
                    }
                    @case ('set_priority') {
                      <p-select [(ngModel)]="action.params['priority']" name="priority-{{ $index }}"
                                [options]="priorityOptions" optionLabel="label" optionValue="value"
                                appendTo="body" size="small" />
                    }
                    @case ('set_status') {
                      <p-select [(ngModel)]="action.params['statusId']" name="statusId-{{ $index }}"
                                [options]="statusOptions()" optionLabel="label" optionValue="value"
                                appendTo="body" size="small" />
                    }
                    @case ('add_label') {
                      <p-select [(ngModel)]="action.params['labelId']" name="labelId-{{ $index }}"
                                [options]="labelOptions()" optionLabel="label" optionValue="value"
                                appendTo="body" size="small" />
                    }
                    @case ('add_comment') {
                      <input type="text" [(ngModel)]="action.params['body']" name="body-{{ $index }}"
                             placeholder="Texto del comentario…"
                             class="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none" />
                    }
                  }
                  <button type="button" (click)="removeAction($index)"
                          class="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Quitar acción">
                    <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                  </button>
                </li>
              } @empty {
                <li class="px-2 py-3 text-center text-xs italic text-slate-400">Sin acciones — agregá la primera.</li>
              }
            </ul>
            <button type="button" (click)="addAction()"
                    class="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-violet-300 hover:text-violet-700">
              <i class="pi pi-plus text-[10px]" aria-hidden="true"></i> Agregar acción
            </button>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" (click)="closeForm()"
                    class="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button type="submit" [disabled]="!canSave() || saving()"
                    class="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60">
              @if (saving()) {
                <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i> Guardando…
              } @else {
                <i class="pi pi-check text-xs" aria-hidden="true"></i> Guardar
              }
            </button>
          </div>
        </form>
      }

      <!-- Existing automations -->
      <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        @if (loading()) {
          <p class="px-4 py-6 text-center text-sm text-slate-400">Cargando…</p>
        } @else if (automations().length === 0) {
          <p class="px-4 py-8 text-center text-sm text-slate-400 italic">Sin reglas configuradas.</p>
        } @else {
          <ul class="divide-y divide-slate-100">
            @for (a of automations(); track a.id) {
              <li class="flex items-center justify-between gap-3 p-4">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span [class]="'h-2 w-2 rounded-full ' + (a.enabled ? 'bg-emerald-500' : 'bg-slate-300')"
                          [attr.title]="a.enabled ? 'Habilitada' : 'Pausada'"></span>
                    <p class="font-semibold text-slate-900 truncate">{{ a.name }}</p>
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">
                    <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono">{{ triggerLabel(a.trigger) }}</span>
                    <span class="mx-1 text-slate-300">→</span>
                    <span>{{ a.actions.length }} acción{{ a.actions.length === 1 ? '' : 'es' }}</span>
                  </p>
                </div>
                <div class="flex items-center gap-1">
                  <button type="button" (click)="toggle(a)"
                          class="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:border-violet-300">
                    {{ a.enabled ? 'Pausar' : 'Activar' }}
                  </button>
                  <button type="button" (click)="edit(a)"
                          class="rounded-lg p-1.5 text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                          aria-label="Editar">
                    <i class="pi pi-pencil text-xs" aria-hidden="true"></i>
                  </button>
                  <button type="button" (click)="remove(a)"
                          class="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                          aria-label="Eliminar">
                    <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
})
export class AutomationsEditorComponent implements OnInit {
  readonly projectId = input.required<string>();

  private readonly api = inject(AutomationApiService);
  private readonly statusStore = inject(WorkflowStatusStore);
  private readonly memberStore = inject(ProjectMemberStore);
  private readonly labelStore = inject(LabelStore);
  private readonly toast = inject(ToastService);

  readonly automations = signal<Automation[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly showForm = signal(false);

  editingId: string | null = null;
  form: {
    name: string;
    enabled: boolean;
    trigger: AutomationTrigger;
    actions: AutomationAction[];
  } = this.emptyForm();

  readonly triggerOptions = (Object.keys(TRIGGER_LABELS) as AutomationTrigger[]).map((k) => ({
    label: TRIGGER_LABELS[k],
    value: k,
  }));
  readonly actionOptions = (Object.keys(ACTION_LABELS) as AutomationActionType[]).map((k) => ({
    label: ACTION_LABELS[k],
    value: k,
  }));
  readonly priorityOptions = PRIORITY_OPTIONS.map((p) => ({ label: p, value: p }));

  readonly statusOptions = computed(() =>
    this.statusStore.byProject(this.projectId())().map((s) => ({ label: s.name, value: s.id })),
  );
  readonly memberOptions = computed(() =>
    this.memberStore
      .byProject(this.projectId())()
      .map((m) => ({ label: m.displayName ?? m.email ?? m.userId, value: m.userId })),
  );
  readonly labelOptions = computed(() =>
    this.labelStore.byProject(this.projectId())().map((l) => ({ label: l.name, value: l.id })),
  );

  async ngOnInit(): Promise<void> {
    await Promise.allSettled([
      this.statusStore.loadForProject(this.projectId()),
      this.memberStore.loadForProject(this.projectId()),
      this.labelStore.loadForProject(this.projectId()),
    ]);
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.automations.set(await this.api.list(this.projectId()));
    } catch {
      this.toast.error('No pudimos cargar las automatizaciones');
    } finally {
      this.loading.set(false);
    }
  }

  triggerLabel(t: AutomationTrigger): string {
    return TRIGGER_LABELS[t] ?? t;
  }

  openForm(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.showForm.set(true);
  }

  edit(a: Automation): void {
    this.editingId = a.id;
    this.form = {
      name: a.name,
      enabled: a.enabled,
      trigger: a.trigger,
      actions: a.actions.map((x) => ({ type: x.type, params: { ...x.params } })),
    };
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingId = null;
  }

  addAction(): void {
    this.form.actions = [...this.form.actions, { type: 'notify_user', params: {} }];
  }

  removeAction(index: number): void {
    this.form.actions = this.form.actions.filter((_, i) => i !== index);
  }

  changeActionType(index: number, type: AutomationActionType): void {
    const next = this.form.actions.slice();
    next[index] = { type, params: {} };
    this.form.actions = next;
  }

  canSave(): boolean {
    return this.form.name.trim().length > 0 && this.form.actions.length > 0;
  }

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const body: CreateAutomationBody = {
        name: this.form.name.trim(),
        trigger: this.form.trigger,
        actions: this.form.actions,
        enabled: this.form.enabled,
      };
      if (this.editingId) {
        await this.api.update(this.projectId(), this.editingId, body);
      } else {
        await this.api.create(this.projectId(), body);
      }
      this.toast.success(this.editingId ? 'Regla actualizada' : 'Regla creada');
      this.closeForm();
      await this.reload();
    } catch (err) {
      const msg = (err as { error?: { detail?: string } })?.error?.detail ?? 'No pudimos guardar';
      this.toast.error(msg);
    } finally {
      this.saving.set(false);
    }
  }

  async toggle(a: Automation): Promise<void> {
    try {
      await this.api.update(this.projectId(), a.id, { enabled: !a.enabled });
      await this.reload();
    } catch {
      this.toast.error('No pudimos cambiar el estado');
    }
  }

  async remove(a: Automation): Promise<void> {
    if (!confirm(`¿Eliminar la regla "${a.name}"?`)) return;
    try {
      await this.api.remove(this.projectId(), a.id);
      await this.reload();
    } catch {
      this.toast.error('No pudimos eliminar la regla');
    }
  }

  private emptyForm() {
    return {
      name: '',
      enabled: true,
      trigger: 'task.created' as AutomationTrigger,
      actions: [] as AutomationAction[],
    };
  }
}
