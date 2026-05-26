import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TaskStore } from '../../stores/task.store';
import { ProjectStore } from '../../stores/project.store';
import { WorkflowStatusStore } from '../../stores/workflow-status.store';
import { ProjectMemberStore } from '../../stores/project-member.store';
import { Task, TaskApiService, TaskPriority, TaskType } from '../../stores/task-api.service';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';

type ProblemType = 'all' | 'bug' | 'incident';

interface TypeMeta {
  icon: string;
  color: string;
  label: string;
}

const TYPE_META: Record<TaskType, TypeMeta> = {
  task: { icon: 'pi pi-check-square', color: 'text-slate-300', label: 'Task' },
  bug: { icon: 'pi pi-bug', color: 'text-rose-400', label: 'Bug' },
  incident: { icon: 'pi pi-exclamation-triangle', color: 'text-amber-400', label: 'Incident' },
  feature: { icon: 'pi pi-star', color: 'text-violet-400', label: 'Feature' },
};

const PRIORITY_OPTS: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

@Component({
  selector: 'jt-tickets-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SkeletonComponent],
  template: `
    <div class="flex flex-col h-full max-w-7xl">
      <!-- Header -->
      <header class="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70 space-y-3">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full
                 border border-violet-200 bg-violet-50"
        >
          <i class="pi pi-exclamation-circle text-violet-600" aria-hidden="true"></i>
          <span
            class="text-[10px] font-bold uppercase tracking-[0.18em]
                   text-violet-700"
          >
            Internal Tickets
          </span>
        </div>
        <h1 class="text-3xl sm:text-4xl font-black tracking-tight">
          <span class="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent">
            Tickets
          </span>
        </h1>
        <p class="text-sm text-slate-600 max-w-2xl">
          Cross-project view of bugs and incidents across your workspace.
        </p>
      </header>

      <!-- Filter bar -->
      <div class="flex items-center gap-3 flex-wrap mb-4">
        <select
          [formControl]="typeControl"
          class="text-sm rounded-lg bg-white border border-slate-200 backdrop-blur-sm
                 px-3 py-2 text-slate-700 outline-none transition capitalize
                 focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
          aria-label="Filter by ticket type"
        >
          <option value="all" class="bg-white text-slate-700">All problems</option>
          <option value="bug" class="bg-white text-slate-700">Bugs</option>
          <option value="incident" class="bg-white text-slate-700">Incidents</option>
        </select>

        <select
          [formControl]="projectControl"
          class="text-sm rounded-lg bg-white border border-slate-200 backdrop-blur-sm
                 px-3 py-2 text-slate-700 outline-none transition
                 focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30 max-w-[12rem]"
          aria-label="Filter by project"
        >
          <option [value]="null" class="bg-white text-slate-700">All projects</option>
          @for (p of projectOptions(); track p.id) {
            <option [value]="p.id" class="bg-white text-slate-700">{{ p.name }}</option>
          }
        </select>

        <select
          [formControl]="priorityControl"
          class="text-sm rounded-lg bg-white border border-slate-200 backdrop-blur-sm
                 px-3 py-2 text-slate-700 outline-none transition capitalize
                 focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
          aria-label="Filter by priority"
        >
          <option [value]="null" class="bg-white text-slate-700">All priorities</option>
          @for (p of priorityOpts; track p) {
            <option [value]="p" class="bg-slate-900 text-white capitalize">{{ p }}</option>
          }
        </select>

        @if (assigneeOptions().length > 0) {
          <select
            [formControl]="assigneeControl"
            class="text-sm rounded-lg bg-white border border-slate-200 backdrop-blur-sm
                   px-3 py-2 text-slate-700 outline-none transition max-w-[10rem]
                   focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
            aria-label="Filter by assignee"
          >
            <option [value]="null" class="bg-white text-slate-700">All assignees</option>
            @for (a of assigneeOptions(); track a) {
              <option [value]="a" class="bg-white text-slate-700">{{ a }}</option>
            }
          </select>
        }

        <div class="relative flex-1 min-w-[12rem] max-w-sm">
          <i
            class="pi pi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            style="font-size: 14px;"
            aria-hidden="true"
          ></i>
          <input
            type="search"
            [formControl]="searchControl"
            class="w-full text-sm rounded-lg bg-white border border-slate-200 backdrop-blur-sm
                   pl-9 pr-3 py-2 text-slate-700 placeholder:text-slate-400 outline-none transition
                   focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
            placeholder="Search tickets..."
            aria-label="Search tickets"
          />
        </div>
      </div>

      <!-- Table -->
      @if (loading()) {
        <jt-skeleton variant="card" />
      } @else if (filteredTickets().length === 0) {
        <div
          class="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center"
          data-testid="tickets-empty"
        >
          <i
            class="pi pi-check-circle text-emerald-400"
            style="font-size: 32px;"
            aria-hidden="true"
          ></i>
          <p class="text-sm text-slate-600 mt-3 font-semibold">No tickets matching your filters.</p>
          <p class="text-xs text-slate-400 mt-1">Either everything is fixed, or there's nothing to triage. Nice.</p>
        </div>
      } @else {
        <div
          class="rounded-2xl border border-dashed border-slate-200 bg-white backdrop-blur-sm overflow-hidden"
          role="table"
          aria-label="Tickets table"
        >
          <div
            class="grid grid-cols-[28px_1fr_140px_90px_120px_110px_100px] gap-3 px-4 py-2.5
                   border-b border-slate-200 bg-white text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"
            role="row"
          >
            <span role="columnheader" aria-label="Type"></span>
            <span role="columnheader">Title</span>
            <span role="columnheader">Project</span>
            <span role="columnheader">Priority</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Assignees</span>
            <span role="columnheader">Due</span>
          </div>

          <ul role="rowgroup" class="divide-y divide-slate-100">
            @for (ticket of filteredTickets(); track ticket.id) {
              <li
                role="row"
                tabindex="0"
                (click)="openTicket(ticket)"
                (keydown.enter)="openTicket(ticket)"
                [attr.aria-label]="typeMeta(ticket.type).label + ': ' + ticket.title"
                data-testid="ticket-row"
                class="grid grid-cols-[28px_1fr_140px_90px_120px_110px_100px] gap-3 px-4 py-3 items-center
                       cursor-pointer hover:bg-slate-50 transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              >
                <i
                  [class]="typeMeta(ticket.type).icon + ' ' + typeMeta(ticket.type).color"
                  style="font-size: 14px;"
                  [attr.aria-label]="typeMeta(ticket.type).label"
                  [attr.title]="typeMeta(ticket.type).label"
                ></i>
                <span class="text-sm text-slate-900 font-semibold truncate">{{ ticket.title }}</span>
                <span class="text-xs text-slate-600 truncate" [attr.title]="projectName(ticket.projectId)">
                  {{ projectName(ticket.projectId) }}
                </span>
                <span class="text-[10px] font-bold uppercase tracking-wide" [class]="priorityClass(ticket.priority)">
                  {{ ticket.priority }}
                </span>
                <span class="text-xs text-slate-600 truncate">
                  {{ statusName(ticket.statusId) }}
                </span>
                <span class="text-xs text-slate-600 truncate">
                  @if ((ticket.assigneeUserIds ?? []).length > 0) {
                    {{ (ticket.assigneeUserIds ?? []).length }} assigned
                  } @else {
                    <span class="text-slate-400">—</span>
                  }
                </span>
                <span class="text-xs text-slate-600">
                  @if (ticket.dueDate) {
                    {{ formatDate(ticket.dueDate) }}
                  } @else {
                    <span class="text-slate-400">—</span>
                  }
                </span>
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `,
})
export class TicketsListComponent implements OnInit {
  private readonly taskStore = inject(TaskStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly statusStore = inject(WorkflowStatusStore, { optional: true });
  private readonly memberStore = inject(ProjectMemberStore, { optional: true });
  private readonly taskApi = inject(TaskApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  // Reactive form controls — using nonNullable for type-safe defaults.
  readonly typeControl = this.fb.nonNullable.control<ProblemType>('all');
  readonly projectControl = this.fb.control<string | null>(null);
  readonly priorityControl = this.fb.control<TaskPriority | null>(null);
  readonly assigneeControl = this.fb.control<string | null>(null);
  readonly searchControl = this.fb.nonNullable.control('');

  readonly priorityOpts = PRIORITY_OPTS;

  readonly loading = signal(false);
  private readonly searchSignal = signal('');
  private readonly typeSignal = signal<ProblemType>('all');
  private readonly projectSignal = signal<string | null>(null);
  private readonly prioritySignal = signal<TaskPriority | null>(null);
  private readonly assigneeSignal = signal<string | null>(null);
  private readonly subs = new Subscription();

  readonly projectOptions = computed(() => this.projectStore.items());

  /**
   * Tickets = tasks across the workspace whose type is 'bug' or 'incident'.
   * This excludes 'task' and 'feature' on purpose — the Tickets view is for problem tracking.
   */
  readonly allTickets = computed<Task[]>(() => {
    return this.taskStore.items().filter(t => t.type === 'bug' || t.type === 'incident');
  });

  readonly assigneeOptions = computed<string[]>(() => {
    const set = new Set<string>();
    for (const t of this.allTickets()) {
      for (const u of t.assigneeUserIds ?? []) set.add(u);
    }
    return [...set].sort();
  });

  readonly filteredTickets = computed<Task[]>(() => {
    const typeFilter = this.typeSignal();
    const projectId = this.projectSignal();
    const priority = this.prioritySignal();
    const assignee = this.assigneeSignal();
    const q = this.searchSignal().trim().toLowerCase();

    return this.allTickets().filter(t => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (projectId && t.projectId !== projectId) return false;
      if (priority && t.priority !== priority) return false;
      if (assignee && !(t.assigneeUserIds ?? []).includes(assignee)) return false;
      if (q.length > 0 && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.subs.add(
      this.typeControl.valueChanges.pipe(distinctUntilChanged()).subscribe(v => this.typeSignal.set(v)),
    );
    this.subs.add(
      this.projectControl.valueChanges.pipe(distinctUntilChanged()).subscribe(v => this.projectSignal.set(v)),
    );
    this.subs.add(
      this.priorityControl.valueChanges.pipe(distinctUntilChanged()).subscribe(v => this.prioritySignal.set(v)),
    );
    this.subs.add(
      this.assigneeControl.valueChanges.pipe(distinctUntilChanged()).subscribe(v => this.assigneeSignal.set(v)),
    );
    this.subs.add(
      this.searchControl.valueChanges
        .pipe(debounceTime(200), distinctUntilChanged())
        .subscribe(v => this.searchSignal.set(v ?? '')),
    );

    void this.loadTickets();
  }

  /**
   * Cross-project tickets are loaded by iterating projects (N+1).
   * MVP tradeoff — acceptable for typical workspace sizes. A dedicated
   * workspace-wide endpoint can replace this when needed.
   */
  async loadTickets(): Promise<void> {
    const projects = this.projectStore.items();
    if (projects.length === 0) return;
    // Only show the skeleton loader if there are no tickets cached yet —
    // otherwise the existing items remain visible during refresh.
    const hasCached = this.allTickets().length > 0;
    if (!hasCached) this.loading.set(true);
    try {
      for (const p of projects) {
        try {
          await this.statusStore?.loadForProject(p.id);
          const tasks = await this.taskApi.list(p.id);
          for (const t of tasks) this.taskStore.upsert(t);
        } catch {
          // Skip project on failure; continue with the others.
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  typeMeta(type: TaskType | undefined): TypeMeta {
    return TYPE_META[type ?? 'task'] ?? TYPE_META.task;
  }

  projectName(projectId: string): string {
    return this.projectStore.byId()[projectId]?.name ?? projectId.slice(0, 8);
  }

  statusName(statusId: string): string {
    if (!this.statusStore) return statusId.slice(0, 6);
    const byId = this.statusStore.byId() as Record<string, { name: string }>;
    return byId[statusId]?.name ?? statusId.slice(0, 6);
  }

  priorityClass(p: TaskPriority): string {
    switch (p) {
      case 'urgent':
        return 'text-rose-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-amber-600';
      case 'low':
        return 'text-sky-600';
      default:
        return 'text-slate-500';
    }
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  openTicket(t: Task): void {
    void this.router.navigate(['/tasks', t.id], {
      queryParams: { projectId: t.projectId },
    });
  }
}
