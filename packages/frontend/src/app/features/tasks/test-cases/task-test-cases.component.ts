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
  TaskTestCaseApiService,
  TaskTestCase,
  TaskTestCaseStatus,
} from '../../../stores/task-test-case-api.service';
import { WorkspaceMemberStore } from '../../../stores/workspace-member.store';
import { ToastService } from '../../../core/toast/toast.service';
import { AiService } from '../../../core/ai/ai.service';

interface StatusMeta {
  label: string;
  icon: string;
  badge: string;
}

const STATUS_META: Record<TaskTestCaseStatus, StatusMeta> = {
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
  skipped: {
    label: 'Salteado',
    icon: 'pi-forward',
    badge: 'border-slate-200 bg-white text-slate-500',
  },
};

const STATUS_ORDER: TaskTestCaseStatus[] = [
  'pending',
  'passed',
  'failed',
  'blocked',
  'skipped',
];

interface DraftTestCase {
  title: string;
  precondition: string;
  steps: string;
  expected: string;
  selected: boolean;
}

/**
 * Test Cases estructurados (Given/When/Then) para una tarea. Cada caso guarda
 * quién (`completedByUserId`) y cuándo (`completedAt`) lo ejecutó, igual que
 * el checklist QA — pero con campos discretos en lugar de markdown libre.
 *
 * Incluye un panel "Sugerir con IA" que llama al endpoint suggest-test-cases
 * del backend; el usuario revisa la lista, edita lo que quiera y elige qué
 * casos persistir.
 */
@Component({
  selector: 'jt-task-test-cases',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe],
  template: `
    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-black uppercase tracking-[0.16em] text-slate-700">
          <i class="pi pi-verified text-xs mr-1.5 text-indigo-600" aria-hidden="true"></i>
          Casos de prueba ({{ items().length }})
        </h3>
        <div class="flex items-center gap-3">
          @if (items().length > 0) {
            <p class="text-[11px] font-semibold text-slate-500">
              <span class="text-emerald-700">{{ countByStatus()['passed'] }}</span>
              ·
              <span class="text-rose-700">{{ countByStatus()['failed'] }}</span>
              ·
              <span class="text-amber-700">{{ countByStatus()['blocked'] }}</span>
              ·
              <span class="text-slate-500">{{ countByStatus()['skipped'] }}</span>
              ·
              <span class="text-slate-600">{{ countByStatus()['pending'] }}</span>
            </p>
          }
          <button
            type="button"
            (click)="fetchSuggestions()"
            [disabled]="aiLoading()"
            class="group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white
                   bg-gradient-to-r from-fuchsia-600 to-violet-600
                   shadow-sm shadow-fuchsia-500/25
                   hover:shadow-md hover:shadow-fuchsia-500/40
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60
                   transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Sugerir casos de prueba con IA"
          >
            <i class="pi pi-sparkles text-[10px]" aria-hidden="true"></i>
            @if (aiLoading()) { Generando… } @else { Sugerir con IA }
          </button>
        </div>
      </header>

      @if (suggestions().length > 0) {
        <div class="mb-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
          <p class="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">
            <i class="pi pi-sparkles text-[10px] mr-1" aria-hidden="true"></i>
            Sugerencias de IA — revisá y elegí
          </p>
          <ul class="space-y-2">
            @for (s of suggestions(); track $index; let idx = $index) {
              <li class="rounded-lg border border-violet-200 bg-white p-3">
                <label class="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    [checked]="s.selected"
                    (change)="toggleSuggestion(idx)"
                    class="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <div class="min-w-0 flex-1 space-y-1.5">
                    <input
                      type="text"
                      [(ngModel)]="s.title"
                      placeholder="Título del caso"
                      class="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
                    />
                    @if (s.precondition || expanded()[idx]) {
                      <textarea
                        rows="2"
                        [(ngModel)]="s.precondition"
                        placeholder="Precondición (Given…)"
                        class="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
                      ></textarea>
                    }
                    @if (s.steps || expanded()[idx]) {
                      <textarea
                        rows="3"
                        [(ngModel)]="s.steps"
                        placeholder="Pasos (When…)"
                        class="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
                      ></textarea>
                    }
                    @if (s.expected || expanded()[idx]) {
                      <textarea
                        rows="2"
                        [(ngModel)]="s.expected"
                        placeholder="Resultado esperado (Then…)"
                        class="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
                      ></textarea>
                    }
                    @if (!expanded()[idx]) {
                      <button
                        type="button"
                        (click)="expand(idx)"
                        class="text-[11px] font-semibold text-violet-700 hover:underline"
                      >
                        Ver detalle…
                      </button>
                    }
                  </div>
                </label>
              </li>
            }
          </ul>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              (click)="confirmSuggestions()"
              [disabled]="selectedCount() === 0 || creatingFromAi()"
              class="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i class="pi pi-check text-[10px]" aria-hidden="true"></i>
              Crear {{ selectedCount() }} caso{{ selectedCount() === 1 ? '' : 's' }}
            </button>
            <button
              type="button"
              (click)="dismissSuggestions()"
              class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Descartar
            </button>
          </div>
        </div>
      }

      @if (loading()) {
        <p class="text-xs text-slate-500">Cargando…</p>
      } @else {
        @if (items().length === 0 && suggestions().length === 0) {
          <p class="mb-4 text-sm italic text-slate-400">
            Sin casos de prueba todavía. Creá uno manualmente o pedí sugerencias con IA.
          </p>
        }

        @if (items().length > 0) {
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
                      'mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-60 ' +
                      meta(item.status).badge
                    "
                    [attr.aria-label]="'Cambiar status (actual: ' + meta(item.status).label + ')'"
                  >
                    <i [class]="'pi ' + meta(item.status).icon + ' text-[10px]'" aria-hidden="true"></i>
                    {{ meta(item.status).label }}
                  </button>

                  <div class="min-w-0 flex-1">
                    @if (editingId() === item.id) {
                      <input
                        type="text"
                        [(ngModel)]="editingTitle"
                        class="mb-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                        placeholder="Título"
                      />
                      <textarea
                        rows="2"
                        [(ngModel)]="editingPrecondition"
                        class="mb-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                        placeholder="Precondición"
                      ></textarea>
                      <textarea
                        rows="3"
                        [(ngModel)]="editingSteps"
                        class="mb-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                        placeholder="Pasos"
                      ></textarea>
                      <textarea
                        rows="2"
                        [(ngModel)]="editingExpected"
                        class="mb-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                        placeholder="Resultado esperado"
                      ></textarea>
                      <div class="flex justify-end gap-2">
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
                          [disabled]="!editingTitle.trim() || updatingId() === item.id"
                          class="rounded-md bg-indigo-600 px-2 py-1 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          Guardar
                        </button>
                      </div>
                    } @else {
                      <p
                        class="text-sm font-semibold text-slate-900 break-words"
                        (dblclick)="startEdit(item)"
                      >
                        {{ item.title }}
                      </p>
                      @if (item.precondition) {
                        <p class="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                          <span class="font-bold text-slate-500">Given:</span>
                          {{ item.precondition }}
                        </p>
                      }
                      @if (item.steps) {
                        <p class="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                          <span class="font-bold text-slate-500">When:</span>
                          {{ item.steps }}
                        </p>
                      }
                      @if (item.expected) {
                        <p class="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                          <span class="font-bold text-slate-500">Then:</span>
                          {{ item.expected }}
                        </p>
                      }
                      @if (item.status !== 'pending' && item.completedByUserId) {
                        <p class="mt-2 text-[11px] text-slate-500">
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
                    <div class="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        (click)="startEdit(item)"
                        class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        aria-label="Editar caso"
                      >
                        <i class="pi pi-pencil text-[11px]" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        (click)="remove(item)"
                        [disabled]="updatingId() === item.id"
                        class="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                        aria-label="Borrar caso"
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

        <div class="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3">
          <input
            type="text"
            [(ngModel)]="draftTitle"
            placeholder="Nuevo caso de prueba — título…"
            aria-label="Nuevo caso"
            class="mb-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
          />
          @if (draftExpanded() || draftPrecondition || draftSteps || draftExpected) {
            <textarea
              rows="2"
              [(ngModel)]="draftPrecondition"
              placeholder="Precondición (Given…)"
              class="mb-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
            ></textarea>
            <textarea
              rows="3"
              [(ngModel)]="draftSteps"
              placeholder="Pasos (When…)"
              class="mb-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
            ></textarea>
            <textarea
              rows="2"
              [(ngModel)]="draftExpected"
              placeholder="Resultado esperado (Then…)"
              class="mb-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
            ></textarea>
          }
          <div class="flex items-center justify-between gap-2">
            @if (!draftExpanded() && !draftPrecondition && !draftSteps && !draftExpected) {
              <button
                type="button"
                (click)="expandDraft()"
                class="text-[11px] font-semibold text-indigo-700 hover:underline"
              >
                Agregar precondición / pasos / esperado…
              </button>
            } @else { <span></span> }
            <button
              type="button"
              (click)="add()"
              [disabled]="!draftTitle.trim() || adding()"
              class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <i class="pi pi-plus text-[10px]" aria-hidden="true"></i>
              Agregar
            </button>
          </div>
        </div>
      }
    </section>
  `,
})
export class TaskTestCasesComponent implements OnChanges {
  private readonly api = inject(TaskTestCaseApiService);
  private readonly members = inject(WorkspaceMemberStore);
  private readonly toast = inject(ToastService);
  private readonly ai = inject(AiService);

  readonly taskId = input.required<string>();

  readonly items = signal<TaskTestCase[]>([]);
  readonly loading = signal(false);
  readonly adding = signal(false);
  readonly updatingId = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly suggestions = signal<DraftTestCase[]>([]);
  readonly expanded = signal<Record<number, boolean>>({});
  readonly creatingFromAi = signal(false);
  readonly draftExpanded = signal(false);

  readonly aiLoading = computed(() => this.ai.loading.suggestTestCases());

  draftTitle = '';
  draftPrecondition = '';
  draftSteps = '';
  draftExpected = '';

  editingTitle = '';
  editingPrecondition = '';
  editingSteps = '';
  editingExpected = '';

  readonly countByStatus = computed(() => {
    const acc: Record<TaskTestCaseStatus, number> = {
      pending: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
    };
    for (const item of this.items()) acc[item.status] += 1;
    return acc;
  });

  readonly selectedCount = computed(
    () => this.suggestions().filter((s) => s.selected).length,
  );

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
      this.toast.error('No pudimos cargar los casos de prueba');
    } finally {
      this.loading.set(false);
    }
  }

  expandDraft(): void {
    this.draftExpanded.set(true);
  }

  async add(): Promise<void> {
    const title = this.draftTitle.trim();
    if (!title) return;
    this.adding.set(true);
    try {
      const created = await this.api.create(this.taskId(), {
        title,
        precondition: this.draftPrecondition.trim() || undefined,
        steps: this.draftSteps.trim() || undefined,
        expected: this.draftExpected.trim() || undefined,
      });
      this.items.update((list) => [...list, created]);
      this.draftTitle = '';
      this.draftPrecondition = '';
      this.draftSteps = '';
      this.draftExpected = '';
      this.draftExpanded.set(false);
    } catch {
      this.toast.error('No pudimos crear el caso');
    } finally {
      this.adding.set(false);
    }
  }

  startEdit(item: TaskTestCase): void {
    this.editingId.set(item.id);
    this.editingTitle = item.title;
    this.editingPrecondition = item.precondition ?? '';
    this.editingSteps = item.steps ?? '';
    this.editingExpected = item.expected ?? '';
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingTitle = '';
    this.editingPrecondition = '';
    this.editingSteps = '';
    this.editingExpected = '';
  }

  async saveEdit(item: TaskTestCase): Promise<void> {
    const title = this.editingTitle.trim();
    if (!title) return;
    this.updatingId.set(item.id);
    try {
      const updated = await this.api.update(this.taskId(), item.id, {
        title,
        precondition: this.editingPrecondition.trim() || null,
        steps: this.editingSteps.trim() || null,
        expected: this.editingExpected.trim() || null,
      });
      this.items.update((list) =>
        list.map((i) => (i.id === item.id ? updated : i)),
      );
      this.cancelEdit();
    } catch {
      this.toast.error('No pudimos actualizar el caso');
    } finally {
      this.updatingId.set(null);
    }
  }

  async cycleStatus(item: TaskTestCase): Promise<void> {
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

  async remove(item: TaskTestCase): Promise<void> {
    this.updatingId.set(item.id);
    try {
      await this.api.remove(this.taskId(), item.id);
      this.items.update((list) => list.filter((i) => i.id !== item.id));
    } catch {
      this.toast.error('No pudimos borrar el caso');
    } finally {
      this.updatingId.set(null);
    }
  }

  async fetchSuggestions(): Promise<void> {
    try {
      const result = await this.ai.suggestTestCases(this.taskId(), {
        maxSuggestions: 5,
        apply: false,
      });
      const drafts: DraftTestCase[] = result.testCases.map((t) => ({
        title: t.title,
        precondition: t.precondition ?? '',
        steps: t.steps ?? '',
        expected: t.expected ?? '',
        selected: true,
      }));
      this.suggestions.set(drafts);
      this.expanded.set({});
    } catch {
      this.toast.error('No pudimos generar sugerencias');
    }
  }

  toggleSuggestion(idx: number): void {
    this.suggestions.update((list) =>
      list.map((s, i) => (i === idx ? { ...s, selected: !s.selected } : s)),
    );
  }

  expand(idx: number): void {
    this.expanded.update((m) => ({ ...m, [idx]: true }));
  }

  dismissSuggestions(): void {
    this.suggestions.set([]);
    this.expanded.set({});
  }

  async confirmSuggestions(): Promise<void> {
    const toCreate = this.suggestions().filter(
      (s) => s.selected && s.title.trim(),
    );
    if (toCreate.length === 0) return;
    this.creatingFromAi.set(true);
    try {
      const created = await Promise.all(
        toCreate.map((s) =>
          this.api.create(this.taskId(), {
            title: s.title.trim(),
            precondition: s.precondition.trim() || undefined,
            steps: s.steps.trim() || undefined,
            expected: s.expected.trim() || undefined,
          }),
        ),
      );
      this.items.update((list) => [...list, ...created]);
      this.suggestions.set([]);
      this.expanded.set({});
      this.toast.success(
        `${created.length} caso${created.length === 1 ? '' : 's'} creado${
          created.length === 1 ? '' : 's'
        }`,
      );
    } catch {
      this.toast.error('No pudimos crear todos los casos sugeridos');
    } finally {
      this.creatingFromAi.set(false);
    }
  }

  meta(status: TaskTestCaseStatus): StatusMeta {
    return STATUS_META[status];
  }

  displayNameOf(userId: string): string {
    return this.members.byId()[userId]?.displayName ?? 'Usuario';
  }
}
