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
import { WorkflowApiService, WorkflowTransition } from '../../stores/workflow-api.service';
import { WorkflowStatusStore } from '../../stores/workflow-status.store';
import { ToastService } from '../../core/toast/toast.service';
import { CheckboxComponent } from '../../shared/checkbox/checkbox.component';

/**
 * Per-project workflow editor — lets admins define which status transitions
 * are allowed (and optionally enforce assignee on certain edges). When the
 * list is empty, the project is in "free mode": any status can move to any
 * other (legacy behavior). The first transition flips the project into
 * "controlled mode" and the backend rejects any edge not in the set.
 */
@Component({
  selector: 'jt-workflow-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, CheckboxComponent],
  template: `
    <section class="space-y-4">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 class="text-lg font-bold text-slate-950">Workflow del proyecto</h3>
          <p class="text-xs text-slate-500">
            @if (transitions().length === 0) {
              Modo libre: cualquier estado puede pasar a cualquier otro.
              Agregá la primera transición para activar el control de flujo.
            } @else {
              Modo controlado: sólo las transiciones listadas son válidas.
            }
          </p>
        </div>
      </header>

      <!-- Add new transition -->
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Desde</label>
            <p-select
              [(ngModel)]="newFromId"
              [options]="statusOptions()"
              optionLabel="label"
              optionValue="value"
              placeholder="Elegir estado…"
              appendTo="body"
              styleClass="w-full"
            />
          </div>
          <div>
            <label class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Hasta</label>
            <p-select
              [(ngModel)]="newToId"
              [options]="statusOptions()"
              optionLabel="label"
              optionValue="value"
              placeholder="Elegir estado…"
              appendTo="body"
              styleClass="w-full"
            />
          </div>
          <jt-checkbox
            [checked]="newRequiresAssignee"
            (checkedChange)="newRequiresAssignee = $event"
            label="Requiere asignado"
            size="sm"
          />
          <button
            type="button"
            (click)="add()"
            [disabled]="!canAdd() || saving()"
            class="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            <i class="pi pi-plus text-xs" aria-hidden="true"></i> Agregar
          </button>
        </div>
      </div>

      <!-- Existing transitions -->
      <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        @if (loading()) {
          <p class="px-4 py-6 text-center text-sm text-slate-400">Cargando…</p>
        } @else if (transitions().length === 0) {
          <p class="px-4 py-8 text-center text-sm text-slate-400 italic">No hay transiciones definidas.</p>
        } @else {
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th class="px-4 py-3 text-left font-bold">Desde</th>
                <th class="px-4 py-3 text-left font-bold"></th>
                <th class="px-4 py-3 text-left font-bold">Hasta</th>
                <th class="px-4 py-3 text-left font-bold">Reglas</th>
                <th class="px-4 py-3 text-right font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (t of transitions(); track t.id) {
                <tr class="border-t border-slate-100">
                  <td class="px-4 py-3 text-slate-800">
                    <span class="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold">{{ statusName(t.fromStatusId) }}</span>
                  </td>
                  <td class="px-4 py-3 text-slate-400"><i class="pi pi-arrow-right text-xs" aria-hidden="true"></i></td>
                  <td class="px-4 py-3 text-slate-800">
                    <span class="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">{{ statusName(t.toStatusId) }}</span>
                  </td>
                  <td class="px-4 py-3">
                    @if (t.requiresAssignee) {
                      <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        <i class="pi pi-user text-[9px]" aria-hidden="true"></i> Requiere asignado
                      </span>
                    } @else {
                      <span class="text-[11px] text-slate-400">—</span>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button type="button" (click)="remove(t)"
                            class="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                            aria-label="Quitar transición">
                      <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </section>
  `,
})
export class WorkflowEditorComponent implements OnInit {
  readonly projectId = input.required<string>();

  private readonly api = inject(WorkflowApiService);
  private readonly statusStore = inject(WorkflowStatusStore);
  private readonly toast = inject(ToastService);

  readonly transitions = signal<WorkflowTransition[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);

  newFromId = '';
  newToId = '';
  newRequiresAssignee = false;

  readonly statuses = computed(() => this.statusStore.byProject(this.projectId())());
  readonly statusOptions = computed(() =>
    this.statuses().map((s) => ({ label: s.name, value: s.id })),
  );

  readonly canAdd = computed(
    () => !!this.newFromId && !!this.newToId && this.newFromId !== this.newToId,
  );

  async ngOnInit(): Promise<void> {
    await this.statusStore.loadForProject(this.projectId());
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.transitions.set(await this.api.list(this.projectId()));
    } catch {
      this.toast.error('No pudimos cargar las transiciones');
    } finally {
      this.loading.set(false);
    }
  }

  async add(): Promise<void> {
    if (!this.canAdd()) return;
    this.saving.set(true);
    try {
      await this.api.create(this.projectId(), {
        fromStatusId: this.newFromId,
        toStatusId: this.newToId,
        requiresAssignee: this.newRequiresAssignee,
      });
      this.toast.success('Transición agregada');
      this.newFromId = '';
      this.newToId = '';
      this.newRequiresAssignee = false;
      await this.reload();
    } catch (err) {
      const msg = (err as { error?: { detail?: string } })?.error?.detail ?? 'No pudimos agregar la transición';
      this.toast.error(msg);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(t: WorkflowTransition): Promise<void> {
    if (!confirm(`Quitar la transición ${this.statusName(t.fromStatusId)} → ${this.statusName(t.toStatusId)}?`)) {
      return;
    }
    try {
      await this.api.remove(this.projectId(), t.id);
      await this.reload();
    } catch {
      this.toast.error('No pudimos quitar la transición');
    }
  }

  statusName(id: string): string {
    return this.statuses().find((s) => s.id === id)?.name ?? '—';
  }
}
