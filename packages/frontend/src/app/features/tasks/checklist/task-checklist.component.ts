import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import {
  TaskChecklistApiService,
  TaskChecklistItem,
  TaskChecklistItemStatus,
} from '../../../stores/task-checklist-api.service';
import { WorkspaceMemberStore } from '../../../stores/workspace-member.store';
import { ToastService } from '../../../core/toast/toast.service';

interface StatusMeta {
  label: string;
  icon: string;
  badge: string;
}

const STATUS_META: Record<TaskChecklistItemStatus, StatusMeta> = {
  pending: {
    label: 'Pendiente',
    icon: 'pi-circle',
    badge: 'border-slate-200 bg-slate-50 text-slate-600',
  },
  passed: {
    label: 'Pasó',
    icon: 'pi-check-circle',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  failed: {
    label: 'Falló',
    icon: 'pi-times-circle',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  blocked: {
    label: 'Bloqueado',
    icon: 'pi-ban',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
  },
};

const STATUS_ORDER: TaskChecklistItemStatus[] = [
  'pending',
  'passed',
  'failed',
  'blocked',
];

/**
 * Checklist de criterios de aceptación / casos QA para una tarea.
 *
 * Cada item guarda quién (`completedByUserId`) y cuándo (`completedAt`) movió
 * el status fuera de `pending` — eso es la trazabilidad que diferencia esto
 * de un checklist genérico.
 */
@Component({
  selector: 'jt-task-checklist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe],
  template: `
    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-black uppercase tracking-[0.16em] text-slate-700">
          <i class="pi pi-list-check text-xs mr-1.5 text-indigo-600" aria-hidden="true"></i>
          Casos QA ({{ items().length }})
        </h3>
        @if (items().length > 0) {
          <p class="text-[11px] font-semibold text-slate-500">
            <span class="text-emerald-700">{{ countByStatus()['passed'] }}</span>
            ·
            <span class="text-rose-700">{{ countByStatus()['failed'] }}</span>
            ·
            <span class="text-amber-700">{{ countByStatus()['blocked'] }}</span>
            ·
            <span class="text-slate-600">{{ countByStatus()['pending'] }}</span>
          </p>
        }
      </header>

      @if (loading()) {
        <p class="text-xs text-slate-500">Cargando…</p>
      } @else {
        @if (items().length === 0) {
          <p class="mb-4 text-sm italic text-slate-400">
            Sin casos de uso todavía. Agregá el primero abajo.
          </p>
        } @else {
          <ul class="mb-4 space-y-2">
            @for (item of items(); track item.id) {
              <li
                class="group rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300"
              >
                <div class="flex items-start gap-3">
                  <button
                    type="button"
                    (click)="cycleStatus(item)"
                    [disabled]="updatingId() === item.id"
                    [class]="
                      'mt-0.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-60 ' +
                      meta(item.status).badge
                    "
                    [attr.aria-label]="'Cambiar status (actual: ' + meta(item.status).label + ')'"
                  >
                    <i [class]="'pi ' + meta(item.status).icon + ' text-[10px]'" aria-hidden="true"></i>
                    {{ meta(item.status).label }}
                  </button>

                  <div class="min-w-0 flex-1">
                    @if (editingId() === item.id) {
                      <textarea
                        rows="2"
                        [(ngModel)]="editingContent"
                        (keydown.escape)="cancelEdit()"
                        class="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-950 outline-none transition
                               focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                        [attr.aria-label]="'Editar criterio'"
                      ></textarea>
                      <div class="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          (click)="cancelEdit()"
                          class="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          (click)="saveEdit(item)"
                          [disabled]="!editingContent.trim() || updatingId() === item.id"
                          class="rounded-md bg-indigo-600 px-2 py-1 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          Guardar
                        </button>
                      </div>
                    } @else {
                      <p
                        class="text-sm text-slate-900 whitespace-pre-wrap break-words"
                        (dblclick)="startEdit(item)"
                      >
                        {{ item.content }}
                      </p>
                      @if (item.status !== 'pending' && item.completedByUserId) {
                        <p class="mt-1 text-[11px] text-slate-500">
                          <i class="pi pi-user text-[9px] mr-1" aria-hidden="true"></i>
                          {{ displayNameOf(item.completedByUserId) }}
                          @if (item.completedAt) {
                            · {{ item.completedAt | date: 'short' }}
                          }
                        </p>
                      }
                    }
                  </div>

                  @if (editingId() !== item.id) {
                    <div class="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        (click)="startEdit(item)"
                        class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        aria-label="Editar criterio"
                      >
                        <i class="pi pi-pencil text-[11px]" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        (click)="remove(item)"
                        [disabled]="updatingId() === item.id"
                        class="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                        aria-label="Borrar criterio"
                      >
                        <i class="pi pi-trash text-[11px]" aria-hidden="true"></i>
                      </button>
                    </div>
                  }
                </div>
              </li>
            }
          </ul>
        }

        <div class="flex gap-2">
          <input
            type="text"
            [(ngModel)]="draftContent"
            (keydown.enter)="add()"
            placeholder="Nuevo criterio de aceptación…"
            aria-label="Nuevo criterio"
            class="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 outline-none transition
                   focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
          />
          <button
            type="button"
            (click)="add()"
            [disabled]="!draftContent.trim() || adding()"
            class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <i class="pi pi-plus text-[10px]" aria-hidden="true"></i>
            Agregar
          </button>
        </div>
      }
    </section>
  `,
})
export class TaskChecklistComponent implements OnChanges {
  private readonly api = inject(TaskChecklistApiService);
  private readonly members = inject(WorkspaceMemberStore);
  private readonly toast = inject(ToastService);

  readonly taskId = input.required<string>();

  readonly items = signal<TaskChecklistItem[]>([]);
  readonly loading = signal(false);
  readonly adding = signal(false);
  readonly updatingId = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);

  draftContent = '';
  editingContent = '';

  readonly countByStatus = computed(() => {
    const acc: Record<TaskChecklistItemStatus, number> = {
      pending: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
    };
    for (const item of this.items()) acc[item.status] += 1;
    return acc;
  });

  constructor() {
    effect(() => {
      const id = this.taskId();
      if (id) void this.load(id);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['taskId']) void this.load(this.taskId());
  }

  async load(taskId: string): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.api.list(taskId);
      this.items.set(list);
    } catch {
      this.toast.error('No pudimos cargar el checklist');
    } finally {
      this.loading.set(false);
    }
  }

  async add(): Promise<void> {
    const content = this.draftContent.trim();
    if (!content) return;
    this.adding.set(true);
    try {
      const created = await this.api.create(this.taskId(), { content });
      this.items.update((list) => [...list, created]);
      this.draftContent = '';
    } catch {
      this.toast.error('No pudimos agregar el criterio');
    } finally {
      this.adding.set(false);
    }
  }

  startEdit(item: TaskChecklistItem): void {
    this.editingId.set(item.id);
    this.editingContent = item.content;
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingContent = '';
  }

  async saveEdit(item: TaskChecklistItem): Promise<void> {
    const content = this.editingContent.trim();
    if (!content || content === item.content) {
      this.cancelEdit();
      return;
    }
    this.updatingId.set(item.id);
    try {
      const updated = await this.api.update(this.taskId(), item.id, { content });
      this.items.update((list) =>
        list.map((i) => (i.id === item.id ? updated : i)),
      );
      this.cancelEdit();
    } catch {
      this.toast.error('No pudimos actualizar el criterio');
    } finally {
      this.updatingId.set(null);
    }
  }

  async cycleStatus(item: TaskChecklistItem): Promise<void> {
    const idx = STATUS_ORDER.indexOf(item.status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    this.updatingId.set(item.id);
    try {
      const updated = await this.api.setStatus(this.taskId(), item.id, next);
      this.items.update((list) =>
        list.map((i) => (i.id === item.id ? updated : i)),
      );
    } catch {
      this.toast.error('No pudimos cambiar el status');
    } finally {
      this.updatingId.set(null);
    }
  }

  async remove(item: TaskChecklistItem): Promise<void> {
    this.updatingId.set(item.id);
    try {
      await this.api.remove(this.taskId(), item.id);
      this.items.update((list) => list.filter((i) => i.id !== item.id));
    } catch {
      this.toast.error('No pudimos borrar el criterio');
    } finally {
      this.updatingId.set(null);
    }
  }

  meta(status: TaskChecklistItemStatus): StatusMeta {
    return STATUS_META[status];
  }

  displayNameOf(userId: string): string {
    return this.members.byId()[userId]?.displayName ?? 'Usuario';
  }
}
