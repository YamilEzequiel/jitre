import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Task, TaskPriority, TaskType } from '../../../stores/task-api.service';
import { WorkflowStatusStore } from '../../../stores/workflow-status.store';
import { LabelStore } from '../../../stores/label.store';
import { ProjectMemberStore } from '../../../stores/project-member.store';
import { WorkspaceMemberStore } from '../../../stores/workspace-member.store';
import { CheckboxComponent } from '../../../shared/checkbox/checkbox.component';

export type TaskCardVariant = 'row' | 'tile';

export interface TaskChangeStatusEvent {
  task: Task;
  newStatusId: string;
}
export interface TaskChangePriorityEvent {
  task: Task;
  newPriority: TaskPriority;
}
export interface TaskChangeAssigneeEvent {
  task: Task;
  userId: string;
  action: 'add' | 'remove';
}

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  none: '',
  low: 'bg-sky-50 text-sky-700 border border-sky-200',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  high: 'bg-orange-50 text-orange-700 border border-orange-200',
  urgent: 'bg-rose-50 text-rose-700 border border-rose-200',
};

const CATEGORY_DOT_FALLBACK: Record<string, string> = {
  todo: 'bg-slate-300',
  in_progress: 'bg-indigo-300',
  done: 'bg-emerald-300',
};

const PRIORITY_OPTIONS: TaskPriority[] = ['none', 'low', 'medium', 'high', 'urgent'];

interface TypeMeta {
  icon: string; // PrimeIcons class
  color: string; // tailwind text color
  label: string;
}

const TYPE_META: Record<TaskType, TypeMeta> = {
  task: { icon: 'pi pi-bookmark', color: 'text-slate-500', label: 'Task' },
  bug: { icon: 'pi pi-bug', color: 'text-rose-400', label: 'Bug' },
  incident: { icon: 'pi pi-exclamation-triangle', color: 'text-amber-400', label: 'Incident' },
  feature: { icon: 'pi pi-star', color: 'text-violet-400', label: 'Feature' },
};

function hashHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

@Component({
  selector: 'jt-task-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent],
  template: `
    @if (variant() === 'tile') {
      <div
        class="group relative flex flex-col gap-3 p-3 rounded-xl
               border border-slate-200 bg-white
               shadow-lg shadow-slate-200/80
               hover:border-blue-200 hover:bg-blue-50/40
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
               focus-visible:ring-offset-2 focus-visible:ring-offset-white
               cursor-grab active:cursor-grabbing transition-colors"
        [class.z-30]="menuOpen()"
        role="listitem"
        tabindex="0"
        (click)="onCardClick($event)"
        (keydown.enter)="selected.emit(task())"
        [attr.aria-label]="ariaLabel() + ' (draggable)'"
      >
        <div class="flex items-start gap-2">
          <i
            [class]="'mt-0.5 ' + typeMeta().icon + ' ' + typeMeta().color"
            style="font-size: 14px;"
            [attr.aria-label]="'Type: ' + typeMeta().label"
            [attr.title]="typeMeta().label"
            data-testid="task-type-icon"
          ></i>
          <div class="flex-1 min-w-0">
            @if (task().issueKey) {
              <p class="mb-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">{{ task().issueKey }}</p>
            }
            <span class="block text-sm font-semibold text-slate-950 line-clamp-2">
              {{ task().title }}
            </span>
          </div>
          <button
            type="button"
            class="opacity-60 hover:opacity-100 p-1 rounded
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            (click)="toggleMenu($event)"
            [attr.aria-expanded]="menuOpen()"
            aria-haspopup="menu"
            aria-label="Task actions"
          >
            <svg class="h-4 w-4 text-slate-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
        </div>

        @if (task().priority !== 'none' || task().dueDate) {
          <div class="flex flex-wrap items-center gap-2">
            @if (task().priority !== 'none') {
              <span [class]="'inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.14em] ' + priorityClass()">
                {{ task().priority }}
              </span>
            }
            @if (task().dueDate) {
              <span [class]="'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ' + dueDateClass()">
                @if (dueIsOverdue()) {
                  <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                }
                {{ formattedDueDate() }}
              </span>
            }
          </div>
        }

        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            @if (avatars().length > 0) {
              <div class="flex -space-x-1.5">
                @for (avatar of avatars(); track avatar.userId) {
                  <span
                    class="inline-flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-bold ring-1 ring-white"
                    [style.background]="avatar.bg"
                    [style.color]="avatar.fg"
                    [attr.aria-label]="'Assignee ' + avatar.label"
                    [attr.title]="avatar.label"
                  >{{ avatar.initials }}</span>
                }
                @if (extraAssignees() > 0) {
                  <span class="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700 ring-1 ring-white">+{{ extraAssignees() }}</span>
                }
              </div>
            }
            @for (label of labels(); track label.id) {
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide"
                [style.background]="label.bg"
                [style.color]="label.fg">{{ label.name }}</span>
            }
            @if (extraLabels() > 0) {
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-700">+{{ extraLabels() }}</span>
            }
          </div>
          @if (subtaskCount() > 0) {
            <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600" [attr.aria-label]="subtaskCount() + ' subtasks'">
              <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              {{ subtaskCount() }}
            </span>
          }
        </div>

        @if (menuOpen()) {
          <div class="fixed inset-0 z-40" (click)="closeMenu($event)" (keydown.escape)="closeMenu($event)" aria-hidden="true"></div>
          <div role="menu" class="absolute right-2 top-10 z-50 w-52 rounded-xl border border-slate-200 bg-white backdrop-blur-xl shadow-2xl shadow-slate-300/80 p-2 space-y-1" (click)="$event.stopPropagation()">
            <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60" (click)="setSubmenu('status')">Change status &rarr;</button>
            <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60" (click)="setSubmenu('priority')">Change priority &rarr;</button>
            <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60" (click)="setSubmenu('assignee')">Assignees &rarr;</button>

            @if (submenu() === 'status') {
              <div class="border-t border-slate-200 mt-2 pt-2 space-y-1">
                @for (s of statusOptions(); track s.id) {
                  <button type="button" role="menuitem" class="w-full text-left px-3 py-1 rounded text-xs text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60" (click)="emitStatus(s.id)">{{ s.name }}</button>
                }
              </div>
            }
            @if (submenu() === 'priority') {
              <div class="border-t border-slate-200 mt-2 pt-2 space-y-1">
                @for (p of priorityOptions; track p) {
                  <button type="button" role="menuitem" class="w-full text-left px-3 py-1 rounded text-xs text-slate-700 hover:bg-slate-100 capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60" (click)="emitPriority(p)">{{ p }}</button>
                }
              </div>
            }
            @if (submenu() === 'assignee') {
              <div class="border-t border-slate-200 mt-2 pt-2 space-y-1 max-h-48 overflow-auto">
                @for (m of memberOptions(); track m.userId) {
                  <label class="flex items-center gap-2 px-2 py-1 rounded text-xs text-slate-700 hover:bg-slate-100 cursor-pointer">
                    <jt-checkbox size="sm" [checked]="isAssignee(m.userId)" (checkedChange)="toggleAssigneeBool(m.userId, $event)" />
                    <span class="truncate">{{ memberLabel(m) }}</span>
                  </label>
                } @empty {
                  <p class="text-xs text-slate-400 px-2 py-1">No members</p>
                }
              </div>
            }
          </div>
        }
      </div>
    } @else {
      <div
        class="group relative flex items-center gap-4 px-4 py-3 rounded-xl
               border border-slate-200 bg-white
               shadow-lg shadow-slate-200/80
               hover:border-blue-200 hover:bg-blue-50/40
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
               focus-visible:ring-offset-2 focus-visible:ring-offset-white
               cursor-pointer transition-colors"
        [class.z-30]="menuOpen()"
        role="row"
        (click)="onCardClick($event)"
        (keydown.enter)="selected.emit(task())"
        tabindex="0"
        [attr.aria-label]="ariaLabel()"
      >
        <span (click)="$event.stopPropagation()">
          <jt-checkbox
            [checked]="isSelected()"
            (checkedChange)="toggleSelect.emit(task().id)"
            [ariaLabel]="'Select task ' + task().title"
          />
        </span>

        <i
          [class]="typeMeta().icon + ' ' + typeMeta().color"
          style="font-size: 14px;"
          [attr.aria-label]="'Type: ' + typeMeta().label"
          [attr.title]="typeMeta().label"
          data-testid="task-type-icon"
        ></i>

        <div class="flex-1 min-w-0">
          @if (task().issueKey) {
            <p class="text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">{{ task().issueKey }}</p>
          }
          <span class="block text-sm font-semibold text-slate-950 truncate">
            {{ task().title }}
          </span>
        </div>

        @if (task().priority !== 'none') {
          <span [class]="'inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.14em] ' + priorityClass()">{{ task().priority }}</span>
        }

        @if (task().dueDate) {
          <span [class]="'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ' + dueDateClass()">
            @if (dueIsOverdue()) {
              <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            }
            {{ formattedDueDate() }}
          </span>
        }

        @if (avatars().length > 0) {
          <div class="flex -space-x-1.5">
            @for (avatar of avatars(); track avatar.userId) {
              <span class="inline-flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-bold ring-1 ring-white"
                [style.background]="avatar.bg"
                [style.color]="avatar.fg"
                [attr.aria-label]="'Assignee ' + avatar.label"
                [attr.title]="avatar.label">{{ avatar.initials }}</span>
            }
            @if (extraAssignees() > 0) {
              <span class="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700 ring-1 ring-white">+{{ extraAssignees() }}</span>
            }
          </div>
        }

        @if (labels().length > 0 || extraLabels() > 0) {
          <div class="flex items-center gap-1">
            @for (label of labels(); track label.id) {
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide"
                [style.background]="label.bg"
                [style.color]="label.fg">{{ label.name }}</span>
            }
            @if (extraLabels() > 0) {
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-700">+{{ extraLabels() }}</span>
            }
          </div>
        }

        @if (subtaskCount() > 0) {
          <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600" [attr.aria-label]="subtaskCount() + ' subtasks'">
            <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            {{ subtaskCount() }}
          </span>
        }

        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] border backdrop-blur-sm text-slate-600 bg-white border-slate-200">
          <span [class]="'h-1.5 w-1.5 rounded-full ' + statusDotClass()" aria-hidden="true"></span>
          {{ statusLabel() }}
        </span>

        <button
          type="button"
          class="opacity-60 hover:opacity-100 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          (click)="toggleMenu($event)"
          [attr.aria-expanded]="menuOpen()"
          aria-haspopup="menu"
          aria-label="Task actions"
        >
          <svg class="h-4 w-4 text-slate-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>

        @if (menuOpen()) {
          <div class="fixed inset-0 z-40" (click)="closeMenu($event)" (keydown.escape)="closeMenu($event)" aria-hidden="true"></div>
          <div role="menu" class="absolute right-2 top-10 z-50 w-52 rounded-xl border border-slate-200 bg-white backdrop-blur-xl shadow-2xl shadow-slate-300/80 p-2 space-y-1" (click)="$event.stopPropagation()">
            <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60" (click)="setSubmenu('status')">Change status &rarr;</button>
            <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60" (click)="setSubmenu('priority')">Change priority &rarr;</button>
            <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60" (click)="setSubmenu('assignee')">Assignees &rarr;</button>

            @if (submenu() === 'status') {
              <div class="border-t border-slate-200 mt-2 pt-2 space-y-1">
                @for (s of statusOptions(); track s.id) {
                  <button type="button" role="menuitem" class="w-full text-left px-3 py-1 rounded text-xs text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60" (click)="emitStatus(s.id)">{{ s.name }}</button>
                }
              </div>
            }
            @if (submenu() === 'priority') {
              <div class="border-t border-slate-200 mt-2 pt-2 space-y-1">
                @for (p of priorityOptions; track p) {
                  <button type="button" role="menuitem" class="w-full text-left px-3 py-1 rounded text-xs text-slate-700 hover:bg-slate-100 capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60" (click)="emitPriority(p)">{{ p }}</button>
                }
              </div>
            }
            @if (submenu() === 'assignee') {
              <div class="border-t border-slate-200 mt-2 pt-2 space-y-1 max-h-48 overflow-auto">
                @for (m of memberOptions(); track m.userId) {
                  <label class="flex items-center gap-2 px-2 py-1 rounded text-xs text-slate-700 hover:bg-slate-100 cursor-pointer">
                    <jt-checkbox size="sm" [checked]="isAssignee(m.userId)" (checkedChange)="toggleAssigneeBool(m.userId, $event)" />
                    <span class="truncate">{{ memberLabel(m) }}</span>
                  </label>
                } @empty {
                  <p class="text-xs text-slate-400 px-2 py-1">No members</p>
                }
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class TaskCardComponent {
  private readonly statusStore = inject(WorkflowStatusStore, { optional: true });
  private readonly labelStore = inject(LabelStore, { optional: true });
  private readonly memberStore = inject(ProjectMemberStore, { optional: true });
  private readonly workspaceMemberStore = inject(WorkspaceMemberStore, { optional: true });

  readonly task = input.required<Task>();
  readonly isSelected = input<boolean>(false);
  readonly variant = input<TaskCardVariant>('row');

  readonly selected = output<Task>();
  readonly toggleSelect = output<string>();
  readonly changedStatus = output<TaskChangeStatusEvent>();
  readonly changedPriority = output<TaskChangePriorityEvent>();
  readonly changedAssignee = output<TaskChangeAssigneeEvent>();

  readonly menuOpen = signal(false);
  readonly submenu = signal<'status' | 'priority' | 'assignee' | null>(null);

  readonly priorityOptions = PRIORITY_OPTIONS;

  readonly status = computed(() => {
    const id = this.task().statusId;
    if (!this.statusStore) return null;
    const byId = this.statusStore.byId() as Record<string, { name: string; color?: string | null; category: string }>;
    return byId[id] ?? null;
  });

  readonly statusLabel = computed(() => {
    const s = this.status();
    if (s) return s.name;
    return this.task().statusId.slice(0, 6);
  });

  readonly statusDotClass = computed(() => {
    const s = this.status();
    return CATEGORY_DOT_FALLBACK[s?.category ?? 'todo'] ?? 'bg-gray-400';
  });

  readonly statusOptions = computed(() => {
    if (!this.statusStore) return [];
    return this.statusStore.byProject(this.task().projectId)();
  });

  readonly priorityClass = computed(() => PRIORITY_CLASSES[this.task().priority] ?? '');

  readonly typeMeta = computed<TypeMeta>(() => {
    const t = this.task().type ?? 'task';
    return TYPE_META[t] ?? TYPE_META.task;
  });

  readonly ariaLabel = computed(() => {
    const t = this.task();
    const meta = this.typeMeta();
    return `${meta.label}: ${t.title}`;
  });

  readonly formattedDueDate = computed(() => {
    const d = this.task().dueDate;
    if (!d) return '';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  readonly dueIsOverdue = computed(() => {
    const d = this.task().dueDate;
    if (!d) return false;
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return false;
    const s = this.status();
    if (s?.category === 'done') return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return date.getTime() < now.getTime();
  });

  readonly dueIsSoon = computed(() => {
    const d = this.task().dueDate;
    if (!d) return false;
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return false;
    const s = this.status();
    if (s?.category === 'done') return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = date.getTime() - now.getTime();
    return diff >= 0 && diff <= 2 * 24 * 60 * 60 * 1000;
  });

  readonly dueDateClass = computed(() => {
    if (this.dueIsOverdue()) return 'bg-rose-50 text-rose-700 border border-rose-200';
    if (this.dueIsSoon()) return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-white text-slate-600 border border-slate-200';
  });

  readonly avatars = computed(() => {
    const ids = (this.task().assigneeUserIds ?? []).slice(0, 3);
    const members = this.memberOptions();
    return ids.map(userId => {
      const hue = hashHue(userId);
      return {
        userId,
        label: this.memberLabel(members.find(member => member.userId === userId) ?? { userId }),
        initials: this.memberLabel(members.find(member => member.userId === userId) ?? { userId })
          .split(/\s+/)
          .slice(0, 2)
          .map(part => part.charAt(0))
          .join('')
          .toUpperCase(),
        // Pastel pair — light fill + deeper-tone text on top.
        bg: `hsl(${hue}, 55%, 88%)`,
        fg: `hsl(${hue}, 35%, 35%)`,
      };
    });
  });

  readonly extraAssignees = computed(() => {
    const total = (this.task().assigneeUserIds ?? []).length;
    return Math.max(0, total - 3);
  });

  readonly labels = computed(() => {
    const ids = (this.task().labelIds ?? []).slice(0, 3);
    if (!this.labelStore) {
      return ids.map(id => ({ id, name: id.slice(0, 6), bg: 'rgba(99,102,241,0.2)', fg: '#c7d2fe' }));
    }
    const byId = this.labelStore.byId() as Record<string, { name: string; color?: string | null }>;
    return ids.map(id => {
      const l = byId[id];
      const color = l?.color ?? '#6366f1';
      return {
        id,
        name: l?.name ?? id.slice(0, 6),
        bg: `${color}33`,
        fg: color,
      };
    });
  });

  readonly extraLabels = computed(() => {
    const total = (this.task().labelIds ?? []).length;
    return Math.max(0, total - 3);
  });

  readonly subtaskCount = computed(() => this.task().subtasks?.length ?? 0);

  readonly memberOptions = computed(() => {
    if (!this.memberStore) return [];
    return this.memberStore.byProject(this.task().projectId)();
  });

  memberLabel(member: { userId: string; displayName?: string; email?: string }): string {
    if (member.displayName) return member.displayName;
    if (member.email) return member.email;
    // Final fallback: ex-members or cross-project assignees that aren't in the
    // ProjectMemberStore for this task can still be resolved via the workspace store.
    const workspace = this.workspaceMemberStore?.memberFor(member.userId);
    return workspace?.displayName ?? workspace?.email ?? member.userId;
  }

  onCardClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[role="menu"]')) {
      return;
    }
    this.selected.emit(this.task());
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    const next = !this.menuOpen();
    this.menuOpen.set(next);
    if (!next) this.submenu.set(null);
  }

  closeMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.submenu.set(null);
  }

  setSubmenu(name: 'status' | 'priority' | 'assignee'): void {
    this.submenu.set(name);
  }

  emitStatus(newStatusId: string): void {
    if (newStatusId !== this.task().statusId) {
      this.changedStatus.emit({ task: this.task(), newStatusId });
    }
    this.menuOpen.set(false);
    this.submenu.set(null);
  }

  emitPriority(newPriority: TaskPriority): void {
    if (newPriority !== this.task().priority) {
      this.changedPriority.emit({ task: this.task(), newPriority });
    }
    this.menuOpen.set(false);
    this.submenu.set(null);
  }

  isAssignee(userId: string): boolean {
    return (this.task().assigneeUserIds ?? []).includes(userId);
  }

  toggleAssignee(userId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.changedAssignee.emit({
      task: this.task(),
      userId,
      action: checked ? 'add' : 'remove',
    });
  }

  toggleAssigneeBool(userId: string, checked: boolean): void {
    this.changedAssignee.emit({
      task: this.task(),
      userId,
      action: checked ? 'add' : 'remove',
    });
  }
}
