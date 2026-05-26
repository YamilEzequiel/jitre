import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Task, TaskApiService, TaskPriority } from '../../../stores/task-api.service';
import { TaskStore } from '../../../stores/task.store';
import { WorkflowStatus } from '../../../stores/workflow-status-api.service';
import { WorkflowStatusStore } from '../../../stores/workflow-status.store';
import { LabelStore } from '../../../stores/label.store';
import { ProjectMemberStore } from '../../../stores/project-member.store';
import { OptimisticUpdateService } from '../../../core/optimistic/optimistic-update.service';
import { ToastService } from '../../../core/toast/toast.service';
import { SkeletonComponent } from '../../../shared/skeleton/skeleton.component';
import {
  TaskCardComponent,
  TaskChangeAssigneeEvent,
  TaskChangePriorityEvent,
  TaskChangeStatusEvent,
} from '../../tasks/list/task-card.component';
import { CreateTaskComponent } from '../../tasks/create/create-task.component';
import { TaskFilters } from '../../tasks/list/task-filter-bar.component';

const CATEGORY_DOT_FALLBACK: Record<string, string> = {
  todo: 'bg-gray-400',
  in_progress: 'bg-indigo-400',
  done: 'bg-emerald-400',
};

interface DropZone {
  statusId: string;
  beforeId?: string;
  afterId?: string;
}

@Component({
  selector: 'jt-kanban-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, TaskCardComponent, CreateTaskComponent],
  template: `
    <div
      class="flex flex-col h-full"
      role="region"
      [attr.aria-label]="'Kanban board'"
    >
      @if (loading()) {
        <div class="flex gap-4 overflow-x-auto pb-4">
          @for (i of [1, 2, 3]; track i) {
            <div class="flex flex-col gap-3 min-w-72 max-w-80 flex-1">
              <jt-skeleton variant="text" />
              <jt-skeleton variant="card" />
              <jt-skeleton variant="card" />
            </div>
          }
        </div>
      } @else if (statuses().length === 0) {
        <div class="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p class="text-sm text-slate-500 mb-2">No workflow statuses configured.</p>
          <p class="text-xs text-slate-400">
            Configure workflow statuses to start using the kanban board.
          </p>
        </div>
      } @else {
        <div class="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm shadow-slate-200/70">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Board</p>
              <h2 class="text-base font-black tracking-tight text-slate-950">Planificación y ejecución</h2>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                {{ totalTasks() }} tareas
              </span>
              <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                {{ doneTasks() }} done
              </span>
              @if (overdueTasks() > 0) {
                <span class="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                  {{ overdueTasks() }} vencidas
                </span>
              }
            </div>
          </div>
        </div>

        <div class="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
          @for (status of statuses(); track status.id) {
            <section
              class="flex flex-col min-w-[12rem] flex-1 rounded-xl
                     border border-slate-200 bg-slate-50/80 backdrop-blur-sm
                     shadow-sm shadow-slate-200/80"
              role="list"
              [attr.aria-label]="'Status ' + status.name"
            >
              <!-- Column header -->
              <header class="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-200 bg-white/80 rounded-t-xl">
                <div class="flex items-center gap-2">
                  <span
                    [class]="'h-2 w-2 rounded-full ' + dotClassFor(status)"
                    [style.background]="status.color ?? ''"
                    aria-hidden="true"
                  ></span>
                  <h3 class="text-xs font-bold uppercase tracking-[0.16em] text-slate-700">
                    {{ status.name }}
                  </h3>
                  <span
                    class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold
                           bg-slate-100 text-slate-600"
                  >
                    {{ tasksFor(status.id).length }}
                  </span>
                </div>
              </header>

              <!-- Task list -->
              <div
                class="flex-1 flex flex-col gap-1.5 px-2.5 pb-2.5 min-h-20"
                (dragover)="onColumnDragOver($event, status.id)"
                (drop)="onColumnDrop($event, status.id)"
              >
                @for (task of tasksFor(status.id); track task.id; let i = $index, last = $last) {
                  <div
                    draggable="true"
                    (dragstart)="onDragStart($event, task)"
                    (dragend)="onDragEnd()"
                    (dragover)="onCardDragOver($event, status.id, task.id, i)"
                    (dragleave)="onDragLeave()"
                    (drop)="onCardDrop($event, status.id, task.id, i)"
                    [class]="(draggingId() === task.id ? 'opacity-50 ' : '') + cardDropHintClass(status.id, task.id, i)"
                  >
                    <jt-task-card
                      [task]="task"
                      variant="tile"
                      (selected)="openTask($event)"
                      (changedStatus)="handleChangedStatus($event)"
                      (changedPriority)="handleChangedPriority($event)"
                      (changedAssignee)="handleChangedAssignee($event)"
                    />
                  </div>
                } @empty {
                  <div
                    class="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center
                           text-xs text-slate-500"
                    (dragover)="onDragOver($event, status.id, null, null)"
                    (dragleave)="onDragLeave()"
                    (drop)="onDrop($event, status.id, undefined, undefined)"
                  >
                    Soltá tareas acá o creá una nueva.
                  </div>
                }
              </div>

              <!-- Add task footer -->
              <button
                type="button"
                (click)="openCreateFor(status.id)"
                class="m-2.5 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-blue-700
                       bg-white border border-blue-100
                       hover:bg-blue-50 hover:border-blue-200 hover:text-blue-800
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                       transition-colors"
              >
                <svg
                  class="h-3 w-3"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Crear tarea
              </button>
            </section>
          }
        </div>
      }
    </div>

    @if (createOpenForStatus() && projectId()) {
      <div
        class="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[2px] md:pl-[19.5rem]"
        role="dialog"
        aria-modal="true"
        aria-label="Create task"
        (click)="closeCreate()"
        (keydown.escape)="closeCreate()"
      >
        <div class="h-full w-full max-w-[88rem] bg-white shadow-2xl shadow-slate-950/20" (click)="$event.stopPropagation()">
          <jt-create-task
            [projectId]="projectId()"
            [preselectedStatusId]="createOpenForStatus()"
            (created)="onTaskCreated($event)"
            (cancelled)="closeCreate()"
          />
        </div>
      </div>
    }
  `,
})
export class KanbanBoardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly statusStore = inject(WorkflowStatusStore);
  private readonly taskStore = inject(TaskStore);
  private readonly memberStore = inject(ProjectMemberStore);
  private readonly labelStore = inject(LabelStore);
  private readonly taskApi = inject(TaskApiService);
  private readonly optimistic = inject(OptimisticUpdateService);
  private readonly toast = inject(ToastService);

  readonly projectId = input.required<string>();
  readonly filters = input<TaskFilters | null>(null);

  readonly loading = signal(true);
  readonly draggingId = signal<string | null>(null);
  readonly hoverDropKey = signal<string | null>(null);
  readonly createOpenForStatus = signal<string | null>(null);

  readonly statuses = computed<WorkflowStatus[]>(() => {
    return this.statusStore.byProject(this.projectId())();
  });

  readonly projectTasks = computed<Task[]>(() => {
    return this.taskStore.byProject(this.projectId())();
  });

  readonly filteredTasks = computed<Task[]>(() => {
    const f = this.filters();
    const tasks = this.projectTasks();
    if (!f) return tasks;
    return tasks.filter(t => {
      if (f.statusId && t.statusId !== f.statusId) return false;
      if (f.priority && t.priority !== f.priority) return false;
      if (f.type && t.type !== f.type) return false;
      if (f.assigneeUserId && !(t.assigneeUserIds ?? []).includes(f.assigneeUserId)) return false;
      if (f.labelId && !(t.labelIds ?? []).includes(f.labelId)) return false;
      if (f.q && f.q.trim().length > 0) {
        const q = f.q.toLowerCase();
        if (!t.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  });

  readonly topLevelTasks = computed<Task[]>(() => {
    return this.filteredTasks().filter(t => !t.parentTaskId);
  });

  readonly totalTasks = computed(() => this.topLevelTasks().length);

  readonly doneTasks = computed(() => {
    const byId = this.statusStore.byId();
    return this.topLevelTasks().filter(t => byId[t.statusId]?.category === 'done').length;
  });

  readonly overdueTasks = computed(() => {
    const today = startOfToday();
    const byId = this.statusStore.byId();
    return this.topLevelTasks().filter(t => {
      if (!t.dueDate || byId[t.statusId]?.category === 'done') return false;
      return new Date(t.dueDate) < today;
    }).length;
  });

  tasksFor(statusId: string): Task[] {
    return this.filteredTasks()
      .filter(t => t.statusId === statusId && !t.parentTaskId)
      .slice()
      .sort((a, b) => a.rank.localeCompare(b.rank));
  }

  openTask(task: Task): void {
    void this.router.navigate(['/tasks', task.id], {
      queryParams: { projectId: task.projectId },
    });
  }

  nextTaskId(statusId: string, index: number): string | null {
    const list = this.tasksFor(statusId);
    return list[index + 1]?.id ?? null;
  }

  dotClassFor(status: WorkflowStatus): string {
    if (status.color) return '';
    return CATEGORY_DOT_FALLBACK[status.category] ?? 'bg-gray-400';
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      await Promise.allSettled([
        this.statusStore.loadForProject(this.projectId()),
        this.taskStore.loadForProject(this.projectId()),
        this.memberStore.loadForProject(this.projectId()),
        this.labelStore.loadForProject(this.projectId()),
      ]);
    } finally {
      this.loading.set(false);
    }
  }

  // ---- Drag & drop ----

  onDragStart(event: DragEvent, task: Task): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
    this.draggingId.set(task.id);
  }

  onDragEnd(): void {
    this.draggingId.set(null);
    this.hoverDropKey.set(null);
  }

  onDragOver(event: DragEvent, statusId: string, beforeId: string | null, afterId: string | null): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.hoverDropKey.set(this.dropKey(statusId, beforeId, afterId));
  }

  onDragLeave(): void {
    this.hoverDropKey.set(null);
  }

  dropTargetClass(statusId: string, beforeId: string | null, afterId: string | null): string {
    return this.hoverDropKey() === this.dropKey(statusId, beforeId, afterId)
      ? 'bg-indigo-500/40 border border-dashed border-indigo-300/60 h-6'
      : '';
  }

  /** Card-level dragover: split the card into top/bottom halves to decide before/after. */
  onCardDragOver(event: DragEvent, statusId: string, taskId: string, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const dropAbove = this.isPointerAboveMidpoint(event);
    if (dropAbove) {
      const prev = this.prevTaskId(statusId, index);
      this.hoverDropKey.set(this.dropKey(statusId, prev, taskId));
    } else {
      const next = this.nextTaskId(statusId, index);
      this.hoverDropKey.set(this.dropKey(statusId, taskId, next));
    }
  }

  /** Card-level drop: same top/bottom split as dragover. */
  onCardDrop(event: DragEvent, statusId: string, taskId: string, index: number): void {
    event.stopPropagation();
    const dropAbove = this.isPointerAboveMidpoint(event);
    if (dropAbove) {
      const prev = this.prevTaskId(statusId, index);
      void this.onDrop(event, statusId, prev ?? undefined, taskId);
    } else {
      const next = this.nextTaskId(statusId, index);
      void this.onDrop(event, statusId, taskId, next);
    }
  }

  /** Column-level fallback (catches drops in empty space below the last card). */
  onColumnDragOver(event: DragEvent, statusId: string): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const list = this.tasksFor(statusId);
    const lastId = list.length > 0 ? list[list.length - 1].id : null;
    this.hoverDropKey.set(this.dropKey(statusId, lastId, null));
  }

  onColumnDrop(event: DragEvent, statusId: string): void {
    const list = this.tasksFor(statusId);
    const lastId = list.length > 0 ? list[list.length - 1].id : undefined;
    void this.onDrop(event, statusId, lastId, undefined);
  }

  /** Visual hint on the card while another card is hovering over a specific half. */
  cardDropHintClass(statusId: string, taskId: string, index: number): string {
    const aboveKey = this.dropKey(statusId, this.prevTaskId(statusId, index), taskId);
    const belowKey = this.dropKey(statusId, taskId, this.nextTaskId(statusId, index));
    const hover = this.hoverDropKey();
    if (hover === aboveKey) return 'border-t-2 border-indigo-400 -mt-px';
    if (hover === belowKey) return 'border-b-2 border-indigo-400 -mb-px';
    return '';
  }

  private prevTaskId(statusId: string, index: number): string | null {
    if (index <= 0) return null;
    const list = this.tasksFor(statusId);
    return list[index - 1]?.id ?? null;
  }

  private isPointerAboveMidpoint(event: DragEvent): boolean {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return true;
    const rect = target.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2;
  }

  async onDrop(event: DragEvent, statusId: string, beforeId: string | undefined, afterId: string | null | undefined): Promise<void> {
    event.preventDefault();
    this.hoverDropKey.set(null);
    const taskId = event.dataTransfer?.getData('text/plain');
    this.draggingId.set(null);
    if (!taskId) return;
    const original = this.taskStore.byId()[taskId];
    if (!original) return;
    if (original.id === beforeId || original.id === afterId) return;

    const droppedZone: DropZone = {
      statusId,
      beforeId: beforeId ?? undefined,
      afterId: afterId ?? undefined,
    };

    const statusChanged = original.statusId !== statusId;
    const newRank = this.computeNewRank(droppedZone, original.id);

    // Optimistic update: change status (if needed) and rank.
    await this.optimistic.run({
      id: original.id,
      apply: () => {
        this.taskStore.upsert({ ...original, statusId, rank: newRank });
        return () => this.taskStore.upsert(original);
      },
      apiCall: async () => {
        if (statusChanged) {
          await this.taskApi.changeStatus(original.projectId, original.id, statusId);
        }
        const repositioned = await this.taskApi.reorder(original.projectId, original.id, {
          beforeId: droppedZone.beforeId,
          afterId: droppedZone.afterId ?? undefined,
        });
        this.taskStore.upsert(repositioned);
      },
      rollbackToast: 'Could not move task. Changes reverted.',
    });
  }

  private dropKey(statusId: string, beforeId: string | null, afterId: string | null): string {
    return `${statusId}|${beforeId ?? '_'}|${afterId ?? '_'}`;
  }

  private computeNewRank(zone: DropZone, taskId: string): string {
    // Compute a rank that places the task between beforeId and afterId in the destination column.
    const colTasks = this.filteredTasks()
      .filter(t => t.statusId === zone.statusId && t.id !== taskId)
      .slice()
      .sort((a, b) => a.rank.localeCompare(b.rank));
    const beforeIdx = zone.beforeId ? colTasks.findIndex(t => t.id === zone.beforeId) : -1;
    const before = beforeIdx >= 0 ? colTasks[beforeIdx] : undefined;
    const after = zone.afterId ? colTasks.find(t => t.id === zone.afterId) : undefined;
    return rankBetween(before?.rank ?? null, after?.rank ?? null);
  }

  // ---- Quick-edit handlers ----

  handleChangedStatus(evt: TaskChangeStatusEvent): void {
    const original = evt.task;
    if (original.statusId === evt.newStatusId) return;
    this.optimistic.run({
      id: original.id,
      apply: () => {
        this.taskStore.upsert({ ...original, statusId: evt.newStatusId });
        return () => this.taskStore.upsert(original);
      },
      apiCall: () => this.taskApi.changeStatus(original.projectId, original.id, evt.newStatusId),
      rollbackToast: 'Could not change status.',
    });
  }

  handleChangedPriority(evt: TaskChangePriorityEvent): void {
    const original = evt.task;
    if (original.priority === evt.newPriority) return;
    this.optimistic.run({
      id: original.id,
      apply: () => {
        this.taskStore.upsert({ ...original, priority: evt.newPriority });
        return () => this.taskStore.upsert(original);
      },
      apiCall: () => this.taskApi.update(original.projectId, original.id, { priority: evt.newPriority as TaskPriority }),
      rollbackToast: 'Could not change priority.',
    });
  }

  handleChangedAssignee(evt: TaskChangeAssigneeEvent): void {
    const original = evt.task;
    const ids = original.assigneeUserIds ?? [];
    const updated =
      evt.action === 'add'
        ? Array.from(new Set([...ids, evt.userId]))
        : ids.filter(id => id !== evt.userId);
    this.optimistic.run({
      id: original.id,
      apply: () => {
        this.taskStore.upsert({ ...original, assigneeUserIds: updated });
        return () => this.taskStore.upsert(original);
      },
      apiCall: () =>
        evt.action === 'add'
          ? this.taskApi.addAssignee(original.projectId, original.id, evt.userId)
          : this.taskApi.removeAssignee(original.projectId, original.id, evt.userId),
      rollbackToast: 'Could not update assignees.',
    });
  }

  // ---- Create modal ----

  openCreateFor(statusId: string): void {
    this.createOpenForStatus.set(statusId);
  }

  closeCreate(): void {
    this.createOpenForStatus.set(null);
  }

  onTaskCreated(task: Task): void {
    this.taskStore.upsert(task);
    this.createOpenForStatus.set(null);
  }
}

/**
 * Compute a rank string that sorts between `before` and `after` using lexicographic comparison.
 * The backend uses LexoRank-style strings; on the client we just need a reasonable midpoint
 * that compares between the two strings — the backend will re-rank on persist if needed.
 */
export function rankBetween(before: string | null, after: string | null): string {
  if (before && after) {
    const mid = midString(before, after);
    if (mid && mid !== before && mid !== after) return mid;
    return before + 'm';
  }
  if (before) return before + 'm';
  if (after) {
    // Lexically before `after` — prefix with '0' until shorter than after's first char if needed.
    const firstCode = after.charCodeAt(0);
    if (firstCode > 'a'.charCodeAt(0)) {
      return String.fromCharCode(firstCode - 1) + after.slice(1);
    }
    return '0' + after;
  }
  return 'n';
}

function midString(a: string, b: string): string {
  // Compute a lexicographic midpoint between a and b (assumes a < b).
  const len = Math.max(a.length, b.length);
  let mid = '';
  let carry = 0;
  for (let i = 0; i < len; i++) {
    const ca = a.charCodeAt(i) || 'a'.charCodeAt(0);
    const cb = b.charCodeAt(i) || 'z'.charCodeAt(0);
    const sum = ca + cb + carry;
    const m = Math.floor(sum / 2);
    carry = (sum % 2) * 256;
    mid += String.fromCharCode(m);
  }
  return mid;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
