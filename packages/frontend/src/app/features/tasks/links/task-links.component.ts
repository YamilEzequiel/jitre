import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SelectModule } from 'primeng/select';
import {
  HydratedTaskLink,
  TaskLinkApiService,
  TaskLinkType,
  TASK_LINK_TYPES,
} from '../../../stores/task-link-api.service';
import { TaskStore } from '../../../stores/task.store';
import { TaskApiService } from '../../../stores/task-api.service';
import { ToastService } from '../../../core/toast/toast.service';

const TYPE_LABEL: Record<TaskLinkType, { out: string; in: string; icon: string; color: string }> = {
  blocks: { out: 'bloquea', in: 'bloqueado por', icon: 'pi-ban', color: 'text-rose-600' },
  relates_to: { out: 'relacionado con', in: 'relacionado con', icon: 'pi-link', color: 'text-blue-600' },
  duplicates: { out: 'duplica a', in: 'duplicado por', icon: 'pi-clone', color: 'text-amber-600' },
  clones: { out: 'clona a', in: 'clonado de', icon: 'pi-copy', color: 'text-violet-600' },
};

/**
 * Linked-issues panel for the task detail view.
 *
 * Renders both outgoing ("A blocks B") and incoming ("A is blocked by C")
 * links — the server returns both directions hydrated with the other task's
 * title so we don't need a second round-trip.
 */
@Component({
  selector: 'jt-task-links',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, RouterLink],
  template: `
    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <header class="mb-4 flex items-center justify-between gap-3">
        <h3 class="text-sm font-black uppercase tracking-[0.16em] text-slate-700">
          <i class="pi pi-link text-xs mr-1.5 text-violet-600" aria-hidden="true"></i>
          Issues vinculados ({{ links().length }})
        </h3>
        <button type="button" (click)="toggleForm()"
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-violet-300 hover:text-violet-700">
          <i [class]="showForm() ? 'pi pi-times text-[10px]' : 'pi pi-plus text-[10px]'" aria-hidden="true"></i>
          {{ showForm() ? 'Cancelar' : 'Vincular' }}
        </button>
      </header>

      @if (showForm()) {
        <div class="mb-4 grid grid-cols-1 sm:grid-cols-[10rem_1fr_auto] gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p-select
            [(ngModel)]="newType"
            [options]="typeOptions"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
          />
          <p-select
            [(ngModel)]="newTargetId"
            [options]="targetOptions()"
            optionLabel="label"
            optionValue="value"
            [placeholder]="loadingTargets() ? 'Cargando tareas…' : (targetOptions().length === 0 ? 'No hay otras tareas en este proyecto' : 'Buscar tarea…')"
            [filter]="true"
            appendTo="body"
            [disabled]="loadingTargets() || targetOptions().length === 0"
          />
          <button type="button" (click)="add()"
                  [disabled]="!newTargetId || saving()"
                  class="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-60">
            <i class="pi pi-check text-[10px]" aria-hidden="true"></i> Vincular
          </button>
        </div>
      }

      @if (links().length === 0) {
        <p class="text-xs text-slate-400 italic">Sin vínculos.</p>
      } @else {
        <ul class="space-y-2">
          @for (l of links(); track l.id) {
            <li class="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
              <i [class]="'pi text-xs ' + iconFor(l) + ' ' + colorFor(l)" aria-hidden="true"></i>
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 w-32 shrink-0">{{ labelFor(l) }}</span>
              <a [routerLink]="['/tasks', l.otherTaskId]"
                 class="flex-1 truncate text-slate-800 hover:text-violet-700">
                {{ l.otherTaskTitle || 'Sin título' }}
              </a>
              <button type="button" (click)="remove(l)"
                      class="rounded p-1 text-rose-500 hover:bg-rose-50" aria-label="Quitar vínculo">
                <i class="pi pi-trash text-[10px]" aria-hidden="true"></i>
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class TaskLinksComponent implements OnChanges {
  readonly taskId = input.required<string>();
  readonly projectId = input.required<string>();

  private readonly api = inject(TaskLinkApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly taskStore = inject(TaskStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly links = signal<HydratedTaskLink[]>([]);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly loadingTargets = signal(false);

  newType: TaskLinkType = 'relates_to';
  newTargetId = '';

  readonly typeOptions: { label: string; value: TaskLinkType }[] = TASK_LINK_TYPES.map((t) => ({
    label: TYPE_LABEL[t].out,
    value: t,
  }));

  readonly targetOptions = computed(() => {
    const tid = this.taskId();
    const linkedIds = new Set(this.links().map((l) => l.otherTaskId));
    return this.taskStore
      .byProject(this.projectId())()
      .filter((t) => t.id !== tid && !linkedIds.has(t.id))
      .map((t) => ({ label: t.title, value: t.id }));
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['taskId']) void this.reload();
  }

  async reload(): Promise<void> {
    try {
      this.links.set(await this.api.list(this.taskId()));
    } catch {
      this.links.set([]);
    }
  }

  async toggleForm(): Promise<void> {
    const willOpen = !this.showForm();
    this.showForm.set(willOpen);
    this.newTargetId = '';
    if (!willOpen) return;

    // When opening the picker, ensure the project tasks are hydrated.
    // The link-issues panel may be the first thing a user opens after
    // landing directly on /tasks/:id, in which case the store only has
    // the current task — the dropdown would otherwise come up empty.
    const pid = this.projectId();
    const haveSiblings = this.taskStore.byProject(pid)().length > 1;
    if (haveSiblings) return;

    this.loadingTargets.set(true);
    try {
      const all = await this.taskApi.list(pid);
      for (const t of all) this.taskStore.upsert(t);
    } catch {
      // Non-fatal: dropdown will just stay empty.
    } finally {
      this.loadingTargets.set(false);
    }
  }

  async add(): Promise<void> {
    if (!this.newTargetId) return;
    this.saving.set(true);
    try {
      await this.api.create(this.taskId(), {
        targetTaskId: this.newTargetId,
        linkType: this.newType,
      });
      this.toast.success('Vinculado');
      this.newTargetId = '';
      this.showForm.set(false);
      await this.reload();
    } catch (err) {
      const msg = (err as { error?: { detail?: string } })?.error?.detail ?? 'No pudimos vincular';
      this.toast.error(msg);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(link: HydratedTaskLink): Promise<void> {
    if (!confirm('¿Quitar este vínculo?')) return;
    try {
      await this.api.remove(this.taskId(), link.id);
      await this.reload();
    } catch {
      this.toast.error('No pudimos quitar el vínculo');
    }
  }

  labelFor(l: HydratedTaskLink): string {
    return l.direction === 'outgoing' ? TYPE_LABEL[l.linkType].out : TYPE_LABEL[l.linkType].in;
  }
  iconFor(l: HydratedTaskLink): string {
    return TYPE_LABEL[l.linkType].icon;
  }
  colorFor(l: HydratedTaskLink): string {
    return TYPE_LABEL[l.linkType].color;
  }
}
