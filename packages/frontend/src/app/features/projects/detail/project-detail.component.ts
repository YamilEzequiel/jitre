import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ProjectStore } from '../../../stores/project.store';
import { TaskStore } from '../../../stores/task.store';
import { WorkflowStatusStore } from '../../../stores/workflow-status.store';
import { LabelStore } from '../../../stores/label.store';
import { ProjectMemberStore } from '../../../stores/project-member.store';
import { Task, TaskApiService } from '../../../stores/task-api.service';
import {
  CreatePlanningItemBody,
  PlanningApiService,
  PlanningItem,
  PlanningItemType,
} from '../../../stores/planning-api.service';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { ToastService } from '../../../core/toast/toast.service';
import { ChatApiService } from '../../../stores/chat-api.service';
import { DocumentApiService, Document } from '../../../stores/document-api.service';
import { SkeletonComponent } from '../../../shared/skeleton/skeleton.component';
import { CreateTaskComponent } from '../../tasks/create/create-task.component';
import { TaskCardComponent } from '../../tasks/list/task-card.component';
import {
  TaskFilterBarComponent,
  TaskFilters,
  StatusOption,
  AssigneeOption,
  LabelOption,
} from '../../tasks/list/task-filter-bar.component';
import { KanbanBoardComponent } from '../board/kanban-board.component';
import { ProjectMembersComponent } from '../members/project-members.component';
import { AttachmentListComponent } from '../../tasks/attachments/attachment-list.component';
import { ChartComponent } from '../../analytics/chart.component';
import {
  WorkflowStatusApiService,
  StatusCategory,
  WorkflowStatus,
} from '../../../stores/workflow-status-api.service';

type ProjectTab = 'tasks' | 'backlog' | 'roadmap' | 'members' | 'files' | 'docs' | 'analytics' | 'settings';
type TaskView = 'board' | 'list';

@Component({
  selector: 'jt-project-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SkeletonComponent,
    CreateTaskComponent,
    TaskCardComponent,
    TaskFilterBarComponent,
    KanbanBoardComponent,
    ProjectMembersComponent,
    AttachmentListComponent,
    ChartComponent,
    RouterLink,
    FormsModule,
    SelectModule,
  ],
  template: `
    <div class="flex min-w-0 flex-col max-w-none">
      @if (project()) {
        <header class="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div class="space-y-1.5">
            <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-violet-200 bg-violet-50">
              <span class="text-[10px] font-bold uppercase tracking-[0.18em] bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                {{ project()!.key }}
              </span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black tracking-tight">
              <span class="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent">
                {{ project()!.name }}
              </span>
            </h1>
            @if (project()!.description) {
              <p class="max-w-2xl text-xs text-slate-600">{{ project()!.description }}</p>
            }
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              (click)="openProjectChat()"
              class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
            >
              <i class="pi pi-comments text-[11px]" aria-hidden="true"></i>
              Abrir chat
            </button>
            @if (activeTab() === 'tasks') {
              <button
                type="button"
                (click)="openCreateTask()"
                class="group inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white
                       bg-gradient-to-r from-indigo-600 to-violet-600
                       shadow-md shadow-indigo-500/25
                       hover:shadow-lg hover:shadow-indigo-500/40
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                       focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                       transition-shadow"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Task
              </button>
            }
          </div>
        </header>

        <div class="flex flex-wrap gap-1 border-b border-slate-200 mb-3" role="tablist">
          @for (tab of tabs; track tab.value) {
            <button
              role="tab"
              [attr.aria-selected]="activeTab() === tab.value"
              [class]="
                'relative rounded-t-lg px-3.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ' +
                (activeTab() === tab.value
                  ? 'border-indigo-500 bg-white text-indigo-700'
                  : 'border-transparent text-slate-600 hover:bg-violet-100 hover:text-violet-900')
              "
              (click)="setActiveTab(tab.value)"
            >
              {{ tab.label }}
            </button>
          }
        </div>

        <div class="min-h-0 pr-1" role="tabpanel">
          @switch (activeTab()) {
            @case ('tasks') {
              <div class="flex flex-col gap-3">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div class="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Timeline</p>
                    <p class="mt-1 text-sm font-semibold text-slate-900">
                      {{ project()!.startDate ?? 'Sin inicio' }} → {{ project()!.targetDate ?? 'Sin objetivo' }}
                    </p>
                  </div>
                  <div class="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Tasks</p>
                    <p class="mt-0.5 text-xl font-black text-slate-950">{{ projectTasks().length }}</p>
                  </div>
                  <div class="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Members</p>
                    <p class="mt-0.5 text-xl font-black text-slate-950">{{ assigneeOptions().length }}</p>
                  </div>
                </div>

                <jt-task-filter-bar
                  [statusOptions]="statusOptions()"
                  [assigneeOptions]="assigneeOptions()"
                  [labelOptions]="labelOptions()"
                  (filterChange)="filters.set($event)"
                />

                <!-- View switcher -->
                <div class="inline-flex items-center gap-0 self-start rounded-lg border border-slate-200 bg-white p-0.5">
                  @for (v of views; track v.value) {
                    <button
                      type="button"
                      [attr.aria-pressed]="taskView() === v.value"
                      [class]="
                        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ' +
                        (taskView() === v.value
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
                      "
                      (click)="setTaskView(v.value)"
                    >
                      {{ v.label }}
                    </button>
                  }
                </div>

                @if (taskView() === 'board') {
                  <jt-kanban-board [projectId]="projectId" [filters]="filters()" />
                } @else {
                  <div class="space-y-2">
                    @for (task of filteredTasks(); track task.id) {
                      <jt-task-card [task]="task" variant="row" (selected)="openTask($event)" />
                    } @empty {
                      <div class="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
                        <p class="text-sm text-slate-500">No tasks match the current filters.</p>
                      </div>
                    }
                  </div>
                }
              </div>
            }
            @case ('members') {
              <jt-project-members [projectId]="projectId" />
            }
            @case ('files') {
              <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <jt-attachment-list context="project" [contextId]="projectId" />
              </section>
            }
            @case ('docs') {
              <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Docs</p>
                    <h3 class="text-base font-black text-slate-950">Project documentation</h3>
                    <p class="text-xs text-slate-500">Pages attached to this project — specs, retros, runbooks.</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <a
                      [routerLink]="['/docs']"
                      [queryParams]="{ projectId }"
                      class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold
                             text-slate-700 bg-white border border-slate-200
                             hover:border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      <i class="pi pi-external-link text-[11px]" aria-hidden="true"></i>
                      Open in editor
                    </a>
                    <button
                      type="button"
                      (click)="createProjectDoc()"
                      class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold
                             text-white bg-gradient-to-r from-indigo-600 to-violet-600
                             shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/40
                             transition-shadow"
                    >
                      <i class="pi pi-plus text-[10px]" aria-hidden="true"></i>
                      New page
                    </button>
                  </div>
                </header>

                @if (projectDocsLoading()) {
                  <p class="text-sm text-slate-400">Loading…</p>
                } @else if (projectDocs().length === 0) {
                  <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
                    <i class="pi pi-file-edit text-2xl text-slate-400 mb-2 block" aria-hidden="true"></i>
                    <p class="text-sm font-semibold text-slate-700">No docs in this project yet</p>
                    <p class="text-[11px] text-slate-400 mt-1">Create the first page to start the project's knowledge base.</p>
                  </div>
                } @else {
                  <ul class="space-y-2">
                    @for (doc of projectDocs(); track doc.id) {
                      <li>
                        <a
                          [routerLink]="['/docs', doc.id]"
                          [queryParams]="{ projectId }"
                          class="group flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5
                                 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                        >
                          <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-700">
                            @if (doc.icon) {
                              <span class="text-base" aria-hidden="true">{{ doc.icon }}</span>
                            } @else {
                              <i class="pi pi-file text-sm" aria-hidden="true"></i>
                            }
                          </span>
                          <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold text-slate-900 truncate">{{ doc.title || 'Untitled' }}</p>
                            <p class="text-[11px] text-slate-400">
                              Edited {{ formatRelative(doc.lastEditedAt ?? doc.updatedAt) }}
                            </p>
                          </div>
                          <i class="pi pi-chevron-right text-[10px] text-slate-300 group-hover:text-indigo-500" aria-hidden="true"></i>
                        </a>
                      </li>
                    }
                  </ul>
                }
              </section>
            }
            @case ('backlog') {
              <div class="space-y-4">
                @if (planningError()) {
                  <p class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{{ planningError() }}</p>
                }
                <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Backlog</p>
                  <h2 class="mt-1 text-xl font-black text-slate-950">Trabajo pendiente</h2>
                  <p class="text-sm text-slate-500">Issues en To Do listos para priorizar o arrastrar al board.</p>
                </div>
                <div class="grid gap-3 lg:grid-cols-2">
                  <section class="rounded-2xl border border-slate-200 bg-white p-4">
                    <p class="text-xs font-black uppercase tracking-wider text-purple-700">Épicas</p>
                    <div class="my-3 flex flex-wrap gap-2">
                      @for (epic of epics(); track epic.id) {
                        <span class="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-800">{{ epic.name }}</span>
                      } @empty {
                        <p class="text-xs text-slate-500">Todavía no hay épicas.</p>
                      }
                    </div>
                    <div class="flex gap-2">
                      <input [(ngModel)]="newEpicName" placeholder="Nueva épica" class="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      <button type="button" (click)="createPlanningItem('epic')" class="rounded-lg bg-purple-700 px-3 py-2 text-xs font-bold text-white">Crear</button>
                    </div>
                  </section>
                  <section class="rounded-2xl border border-slate-200 bg-white p-4">
                    <p class="text-xs font-black uppercase tracking-wider text-blue-700">Sprints</p>
                    <div class="my-3 flex flex-wrap gap-2">
                      @for (sprint of sprints(); track sprint.id) {
                        <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{{ sprint.name }}</span>
                      } @empty {
                        <p class="text-xs text-slate-500">Creá un sprint para planificar.</p>
                      }
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2">
                      <input [(ngModel)]="newSprintName" placeholder="Sprint 1" class="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      <button type="button" (click)="createPlanningItem('sprint')" class="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Crear sprint</button>
                      <input [(ngModel)]="newSprintStartDate" type="date" aria-label="Inicio de sprint" class="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      <input [(ngModel)]="newSprintEndDate" type="date" aria-label="Fin de sprint" class="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                  </section>
                </div>
                @for (task of backlogTasks(); track task.id) {
                  <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <jt-task-card [task]="task" variant="row" (selected)="openTask($event)" />
                    <div class="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-end">
                      <label class="flex min-w-0 items-center gap-2">
                        <span class="shrink-0 text-[10px] font-bold uppercase tracking-wider text-purple-700">Épica</span>
                        <p-select
                          [ngModel]="task.epicId ?? ''"
                          (ngModelChange)="assignPlanning(task, 'epicId', $event)"
                          [options]="epicSelectOptions()"
                          optionLabel="label"
                          optionValue="value"
                          size="small"
                          appendTo="body"
                          styleClass="min-w-0 flex-1 sm:w-44 sm:flex-none"
                        />
                      </label>
                      <label class="flex min-w-0 items-center gap-2">
                        <span class="shrink-0 text-[10px] font-bold uppercase tracking-wider text-blue-700">Sprint</span>
                        <p-select
                          [ngModel]="task.sprintId ?? ''"
                          (ngModelChange)="assignPlanning(task, 'sprintId', $event)"
                          [options]="sprintSelectOptions()"
                          optionLabel="label"
                          optionValue="value"
                          size="small"
                          appendTo="body"
                          styleClass="min-w-0 flex-1 sm:w-44 sm:flex-none"
                        />
                      </label>
                    </div>
                  </div>
                } @empty {
                  <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                    No hay issues pendientes en backlog.
                  </div>
                }
              </div>
            }
            @case ('roadmap') {
              <div class="space-y-4">
                @if (planningError()) {
                  <p class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{{ planningError() }}</p>
                }
                <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Roadmap</p>
                  <h2 class="mt-1 text-xl font-black text-slate-950">Timeline de entregas</h2>
                  <p class="text-sm text-slate-500">Planificación basada en fechas de inicio y vencimiento de issues.</p>
                </div>
                <section class="rounded-2xl border border-slate-200 bg-white p-4">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <p class="text-xs font-black uppercase tracking-wider text-emerald-700">Releases</p>
                    <div class="flex flex-wrap gap-2">
                      <input [(ngModel)]="newReleaseName" placeholder="v1.0" class="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      <input [(ngModel)]="newReleaseDate" type="date" aria-label="Fecha de release" class="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      <button type="button" (click)="createPlanningItem('release')" class="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Crear release</button>
                    </div>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-2">
                    @for (release of releases(); track release.id) {
                      <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{{ release.name }}</span>
                    } @empty {
                      <p class="text-xs text-slate-500">No hay releases planificados.</p>
                    }
                  </div>
                </section>
                @for (task of roadmapTasks(); track task.id) {
                  <div class="grid items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[8rem_1fr_13rem_10rem]">
                    <p class="text-xs font-black uppercase tracking-[0.14em] text-blue-700">{{ task.issueKey || 'ISSUE' }}</p>
                    <p class="truncate text-sm font-bold text-slate-950">{{ task.title }}</p>
                    <p class="text-xs font-semibold text-slate-600">{{ task.startDate || 'Sin inicio' }} → {{ task.dueDate || 'Sin fecha' }}</p>
                    <p-select
                      [ngModel]="task.releaseId ?? ''"
                      (ngModelChange)="assignPlanning(task, 'releaseId', $event)"
                      [options]="releaseSelectOptions()"
                      optionLabel="label"
                      optionValue="value"
                      size="small"
                      appendTo="body"
                    />
                  </div>
                } @empty {
                  <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                    Agregá fechas en las tareas para construir el roadmap.
                  </div>
                }
              </div>
            }
            @case ('analytics') {
              <div class="space-y-4">
                <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Analytics</p>
                  <h2 class="mt-1 text-xl font-black text-slate-950">Project health</h2>
                  <p class="text-sm text-slate-500">Numbers + charts derived from the current task data.</p>
                </div>

                <!-- KPI tiles -->
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div class="rounded-2xl border border-slate-200 bg-white p-4">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Velocity</p>
                    <p class="mt-2 text-2xl font-black text-slate-950">{{ projectAnalytics().velocity }}</p>
                  </div>
                  <div class="rounded-2xl border border-slate-200 bg-white p-4">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Burndown</p>
                    <p class="mt-2 text-2xl font-black text-slate-950">{{ projectAnalytics().burndownPoints }}</p>
                    <p class="text-xs text-slate-500">points</p>
                  </div>
                  <div class="rounded-2xl border border-slate-200 bg-white p-4">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lead time</p>
                    <p class="mt-2 text-2xl font-black text-slate-950">{{ projectAnalytics().leadTimeBuckets }}</p>
                    <p class="text-xs text-slate-500">buckets</p>
                  </div>
                  <div class="rounded-2xl border border-slate-200 bg-white p-4">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cycle time</p>
                    <p class="mt-2 text-2xl font-black text-slate-950">{{ projectAnalytics().cycleTimeBuckets }}</p>
                    <p class="text-xs text-slate-500">buckets</p>
                  </div>
                  <div class="rounded-2xl border border-slate-200 bg-white p-4">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status flow</p>
                    <p class="mt-2 text-2xl font-black text-slate-950">{{ projectAnalytics().statusFlowEdges }}</p>
                    <p class="text-xs text-slate-500">transitions</p>
                  </div>
                </div>

                <!-- Charts: 2-col responsive grid -->
                <div class="grid gap-4 lg:grid-cols-2">
                  <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <header class="mb-3">
                      <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Status mix</p>
                      <h3 class="text-sm font-bold text-slate-900">Tasks by workflow status</h3>
                    </header>
                    <div class="h-64">
                      <jt-chart chartType="doughnut" [chartData]="$any(statusChartData())" ariaLabel="Tasks by status" />
                    </div>
                  </section>

                  <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <header class="mb-3">
                      <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Priority mix</p>
                      <h3 class="text-sm font-bold text-slate-900">Tasks by priority</h3>
                    </header>
                    <div class="h-64">
                      <jt-chart chartType="doughnut" [chartData]="$any(priorityChartData())" ariaLabel="Tasks by priority" />
                    </div>
                  </section>

                  <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                    <header class="mb-3 flex items-center justify-between">
                      <div>
                        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Flow</p>
                        <h3 class="text-sm font-bold text-slate-900">Created vs completed — last 8 weeks</h3>
                      </div>
                    </header>
                    <div class="h-72">
                      <jt-chart chartType="line" [chartData]="$any(flowChartData())" ariaLabel="Weekly created vs completed" />
                    </div>
                  </section>

                  <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                    <header class="mb-3">
                      <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workload</p>
                      <h3 class="text-sm font-bold text-slate-900">Tasks per assignee (top 6)</h3>
                    </header>
                    <div class="h-64">
                      <jt-chart chartType="bar" [chartData]="$any(workloadChartData())" ariaLabel="Tasks per assignee" />
                    </div>
                  </section>
                </div>
              </div>
            }
            @case ('settings') {
              <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div class="mb-5">
                  <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Workflow</p>
                  <h2 class="text-xl font-black text-slate-950">Estados del proyecto</h2>
                  <p class="text-sm text-slate-500">Configurá columnas para adaptar el flujo del equipo.</p>
                </div>
                <div class="mb-5 space-y-2">
                  @for (status of workflowStatuses(); track status.id) {
                    <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      @if (editingStatusId() === status.id) {
                        <div class="grid gap-2 sm:grid-cols-[1fr_11rem_auto]">
                          <input [(ngModel)]="editStatusName" type="text" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950" />
                          <p-select
                            [(ngModel)]="editStatusCategory"
                            [options]="statusCategoryOptions"
                            optionLabel="label"
                            optionValue="value"
                            appendTo="body"
                          />
                          <div class="flex gap-2">
                            <button type="button" (click)="saveStatus(status)" class="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Guardar</button>
                            <button type="button" (click)="editingStatusId.set(null)" class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Cancelar</button>
                          </div>
                        </div>
                      } @else {
                        <div class="flex flex-wrap items-center justify-between gap-3">
                          <div class="flex items-center gap-3">
                            <span class="h-2.5 w-2.5 rounded-full bg-blue-600" [style.background]="status.color ?? ''"></span>
                            <p class="text-sm font-bold text-slate-950">{{ status.name }}</p>
                            <span class="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">{{ status.category }}</span>
                          </div>
                          <div class="flex items-center gap-1">
                            <button type="button" (click)="moveStatus(status, -1)" class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600" aria-label="Mover estado arriba">↑</button>
                            <button type="button" (click)="moveStatus(status, 1)" class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600" aria-label="Mover estado abajo">↓</button>
                            <button type="button" (click)="editStatus(status)" class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">Editar</button>
                          </div>
                        </div>
                        @if (workflowStatuses().length > 1) {
                          <div class="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
                            <label class="text-xs font-semibold text-slate-500">Mover tareas a</label>
                            <p-select
                              [ngModel]="deleteReplacementByStatus[status.id] ?? ''"
                              (ngModelChange)="deleteReplacementByStatus[status.id] = $event"
                              [options]="replacementOptionsFor(status.id)"
                              optionLabel="label"
                              optionValue="value"
                              placeholder="Elegir reemplazo"
                              size="small"
                              appendTo="body"
                            />
                            <button
                              type="button"
                              (click)="deleteStatus(status)"
                              [disabled]="!deleteReplacementByStatus[status.id]"
                              class="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-40"
                            >
                              Eliminar
                            </button>
                          </div>
                        }
                      }
                    </div>
                  }
                </div>
                @if (workflowError()) {
                  <p class="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{{ workflowError() }}</p>
                }
                <div class="grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-[1fr_12rem_auto]">
                  <input [(ngModel)]="newStatusName" type="text" placeholder="Ej. QA Review" class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-500" />
                  <p-select
                    [(ngModel)]="newStatusCategory"
                    [options]="statusCategoryOptions"
                    optionLabel="label"
                    optionValue="value"
                    appendTo="body"
                  />
                  <button type="button" (click)="createStatus()" [disabled]="!newStatusName.trim() || savingWorkflow()" class="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                    Agregar estado
                  </button>
                </div>
              </section>
            }
          }
        </div>
      } @else {
        <jt-skeleton variant="card" />
      }
    </div>

    @if (showCreateTask() && projectId) {
      <div
        class="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[2px] md:pl-[19.5rem]"
        role="dialog"
        aria-modal="true"
        aria-label="Create task"
        (click)="closeCreateTask()"
        (keydown.escape)="closeCreateTask()"
      >
        <div class="h-full w-full max-w-[88rem] bg-white shadow-2xl shadow-slate-950/20" (click)="$event.stopPropagation()">
          <jt-create-task
            [projectId]="projectId"
            (created)="onTaskCreated($event)"
            (cancelled)="closeCreateTask()"
          />
        </div>
      </div>
    }
  `,
})
export class ProjectDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectStore = inject(ProjectStore);
  private readonly taskStore = inject(TaskStore);
  private readonly statusStore = inject(WorkflowStatusStore);
  private readonly labelStore = inject(LabelStore);
  private readonly memberStore = inject(ProjectMemberStore);
  private readonly analytics = inject(AnalyticsService);
  private readonly statusApi = inject(WorkflowStatusApiService);
  private readonly planningApi = inject(PlanningApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly toast = inject(ToastService);
  private readonly chatApi = inject(ChatApiService);
  private readonly documentApi = inject(DocumentApiService);

  readonly activeTab = signal<ProjectTab>('tasks');
  readonly projectDocs = signal<Document[]>([]);
  readonly projectDocsLoading = signal(false);
  readonly taskView = signal<TaskView>('board');
  readonly showCreateTask = signal(false);
  readonly filters = signal<TaskFilters | null>(null);
  readonly projectAnalytics = signal({ velocity: 0, burndownPoints: 0, leadTimeBuckets: 0, cycleTimeBuckets: 0, statusFlowEdges: 0 });
  readonly savingWorkflow = signal(false);
  readonly editingStatusId = signal<string | null>(null);
  readonly workflowError = signal<string | null>(null);
  readonly planningItems = signal<PlanningItem[]>([]);
  readonly planningError = signal<string | null>(null);
  newStatusName = '';
  newStatusCategory: StatusCategory = 'in_progress';
  editStatusName = '';
  editStatusCategory: StatusCategory = 'in_progress';
  deleteReplacementByStatus: Partial<Record<string, string>> = {};
  newEpicName = '';
  newSprintName = '';
  newSprintStartDate = '';
  newSprintEndDate = '';
  newReleaseName = '';
  newReleaseDate = '';

  projectId = '';

  readonly tabs: { value: ProjectTab; label: string }[] = [
    { value: 'tasks', label: 'Tasks' },
    { value: 'backlog', label: 'Backlog' },
    { value: 'roadmap', label: 'Roadmap' },
    { value: 'members', label: 'Members' },
    { value: 'docs', label: 'Docs' },
    { value: 'files', label: 'Files' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'settings', label: 'Settings' },
  ];

  readonly views: { value: TaskView; label: string }[] = [
    { value: 'board', label: 'Board' },
    { value: 'list', label: 'List' },
  ];

  readonly project = computed(() => {
    return this.projectStore.byId()[this.projectId] ?? null;
  });

  readonly projectTasks = computed(() => {
    return this.taskStore.byProject(this.projectId)();
  });

  readonly statusOptions = computed<StatusOption[]>(() => {
    return this.statusStore.byProject(this.projectId)().map(s => ({ id: s.id, name: s.name }));
  });

  readonly assigneeOptions = computed<AssigneeOption[]>(() => {
    return this.memberStore.byProject(this.projectId)().map(m => ({
      userId: m.userId,
      label: m.displayName ?? m.email ?? m.userId,
    }));
  });

  readonly labelOptions = computed<LabelOption[]>(() => {
    return this.labelStore.byProject(this.projectId)().map(l => ({ id: l.id, name: l.name }));
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

  readonly workflowStatuses = computed(() => this.statusStore.byProject(this.projectId)());

  readonly backlogTasks = computed(() => {
    const statuses = this.statusStore.byId();
    return this.projectTasks().filter(t => !t.parentTaskId && statuses[t.statusId]?.category === 'todo');
  });

  readonly roadmapTasks = computed(() =>
    this.projectTasks()
      .filter(t => !t.parentTaskId && (t.startDate || t.dueDate))
      .slice()
      .sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31')),
  );
  readonly epics = computed(() => this.planningItems().filter(item => item.type === 'epic'));
  readonly sprints = computed(() => this.planningItems().filter(item => item.type === 'sprint'));
  readonly releases = computed(() => this.planningItems().filter(item => item.type === 'release'));

  readonly epicSelectOptions = computed(() => [
    { label: 'Sin épica', value: '' },
    ...this.epics().map(e => ({ label: e.name, value: e.id })),
  ]);
  readonly sprintSelectOptions = computed(() => [
    { label: 'Backlog', value: '' },
    ...this.sprints().map(s => ({ label: s.name, value: s.id })),
  ]);
  readonly releaseSelectOptions = computed(() => [
    { label: 'Sin release', value: '' },
    ...this.releases().map(r => ({ label: r.name, value: r.id })),
  ]);

  readonly statusCategoryOptions = [
    { label: 'To do', value: 'todo' },
    { label: 'In progress', value: 'in_progress' },
    { label: 'Done', value: 'done' },
  ];

  replacementOptionsFor(excludeId: string): { label: string; value: string }[] {
    return this.workflowStatuses()
      .filter(s => s.id !== excludeId)
      .map(s => ({ label: s.name, value: s.id }));
  }

  // ---- Analytics chart data ----

  /** Tasks grouped by their workflow-status name (one slice per column). */
  readonly statusBreakdown = computed(() => {
    const statuses = this.statusStore.byProject(this.projectId)();
    const byStatusId = new Map(statuses.map(s => [s.id, s.name]));
    const counts = new Map<string, number>();
    for (const t of this.projectTasks()) {
      const name = byStatusId.get(t.statusId) ?? 'Unknown';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return { labels: [...counts.keys()], values: [...counts.values()] };
  });

  /** Tasks grouped by priority — keep a stable order so colors stay consistent. */
  readonly priorityBreakdown = computed(() => {
    const order: Array<{ key: string; label: string }> = [
      { key: 'urgent', label: 'Urgent' },
      { key: 'high', label: 'High' },
      { key: 'medium', label: 'Medium' },
      { key: 'low', label: 'Low' },
      { key: 'none', label: 'None' },
    ];
    const counts = new Map<string, number>();
    for (const t of this.projectTasks()) counts.set(t.priority, (counts.get(t.priority) ?? 0) + 1);
    return {
      labels: order.map(o => o.label),
      values: order.map(o => counts.get(o.key) ?? 0),
    };
  });

  /** Last 8 weeks: tasks created vs completed per week. */
  readonly weeklyFlow = computed(() => {
    const buckets = 8;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(now);
    // Start from the Monday of the bucket window.
    start.setDate(start.getDate() - 7 * (buckets - 1));
    const labels: string[] = [];
    const created = new Array(buckets).fill(0);
    const completed = new Array(buckets).fill(0);
    for (let i = 0; i < buckets; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + 7 * i);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    for (const t of this.projectTasks()) {
      if (t.createdAt) {
        const idx = this.bucketIndex(start, t.createdAt, buckets);
        if (idx >= 0) created[idx]++;
      }
      if (t.completedAt) {
        const idx = this.bucketIndex(start, t.completedAt, buckets);
        if (idx >= 0) completed[idx]++;
      }
    }
    return { labels, created, completed };
  });

  /** Tasks per assignee (top 6) for the workload bar. */
  readonly workload = computed(() => {
    const members = this.memberStore.byProject(this.projectId)();
    const labelFor = (userId: string) =>
      members.find(m => m.userId === userId)?.displayName ??
      members.find(m => m.userId === userId)?.email ??
      'User';
    const counts = new Map<string, number>();
    for (const t of this.projectTasks()) {
      for (const uid of t.assigneeUserIds ?? []) counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return {
      labels: sorted.map(([uid]) => labelFor(uid)),
      values: sorted.map(([, n]) => n),
    };
  });

  private bucketIndex(start: Date, iso: string, buckets: number): number {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return -1;
    const days = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const idx = Math.floor(days / 7);
    return idx >= 0 && idx < buckets ? idx : -1;
  }

  // Chart.js data builders — kept as plain methods to avoid a wider refactor.
  statusChartData(): unknown {
    const b = this.statusBreakdown();
    return {
      labels: b.labels,
      datasets: [{
        data: b.values,
        backgroundColor: ['#818cf8', '#a78bfa', '#f0abfc', '#fb7185', '#fbbf24', '#34d399', '#60a5fa'],
        borderWidth: 0,
      }],
    };
  }

  priorityChartData(): unknown {
    const b = this.priorityBreakdown();
    return {
      labels: b.labels,
      datasets: [{
        data: b.values,
        backgroundColor: ['#e11d48', '#f97316', '#f59e0b', '#0ea5e9', '#94a3b8'],
        borderWidth: 0,
      }],
    };
  }

  flowChartData(): unknown {
    const w = this.weeklyFlow();
    return {
      labels: w.labels,
      datasets: [
        {
          label: 'Created',
          data: w.created,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          tension: 0.35,
          fill: true,
        },
        {
          label: 'Completed',
          data: w.completed,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          tension: 0.35,
          fill: true,
        },
      ],
    };
  }

  workloadChartData(): unknown {
    const w = this.workload();
    return {
      labels: w.labels,
      datasets: [{
        label: 'Tasks',
        data: w.values,
        backgroundColor: '#7c3aed',
        borderRadius: 6,
      }],
    };
  }

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    this.taskView.set(this.loadViewPreference());
    void this.loadProjectContext();
  }

  setActiveTab(tab: ProjectTab): void {
    this.activeTab.set(tab);
    // Lazy-load the docs list the first time the user opens the Docs tab so
    // we don't fetch it for projects that never need it.
    if (tab === 'docs') void this.loadProjectDocs();
  }

  openCreateTask(): void {
    this.showCreateTask.set(true);
  }

  openTask(task: Task): void {
    void this.router.navigate(['/tasks', task.id], {
      queryParams: { projectId: task.projectId },
    });
  }

  async openProjectChat(): Promise<void> {
    if (!this.projectId) return;
    try {
      const channel = await this.chatApi.getProjectChannel(this.projectId);
      await this.router.navigate(['/chat', channel.id]);
    } catch {
      this.toast.error('No se pudo abrir el chat del proyecto.');
    }
  }

  // ---- Project docs ----

  async loadProjectDocs(): Promise<void> {
    if (!this.projectId) return;
    this.projectDocsLoading.set(true);
    try {
      const docs = await this.documentApi.list({ projectId: this.projectId });
      this.projectDocs.set(docs);
    } catch {
      this.projectDocs.set([]);
    } finally {
      this.projectDocsLoading.set(false);
    }
  }

  async createProjectDoc(): Promise<void> {
    if (!this.projectId) return;
    try {
      const created = await this.documentApi.create({
        title: 'Untitled',
        projectId: this.projectId,
      });
      await this.router.navigate(['/docs', created.id], {
        queryParams: { projectId: this.projectId },
      });
    } catch {
      this.toast.error('Failed to create page');
    }
  }

  formatRelative(iso: string | null): string {
    if (!iso) return 'just now';
    const ms = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(ms)) return 'just now';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
  }

  closeCreateTask(): void {
    this.showCreateTask.set(false);
  }

  onTaskCreated(task: Task): void {
    this.taskStore.upsert(task);
    this.closeCreateTask();
  }

  setTaskView(view: TaskView): void {
    this.taskView.set(view);
    this.saveViewPreference(view);
  }

  private storageKey(): string {
    return `jitre.project.${this.projectId}.taskView`;
  }

  private loadViewPreference(): TaskView {
    try {
      const v = localStorage.getItem(this.storageKey());
      if (v === 'list' || v === 'board') return v;
    } catch {
      // SSR or storage unavailable — fall through to default.
    }
    return 'board';
  }

  private saveViewPreference(view: TaskView): void {
    try {
      localStorage.setItem(this.storageKey(), view);
    } catch {
      // Ignore quota / SSR.
    }
  }

  private async loadProjectContext(): Promise<void> {
    if (!this.projectId) return;
    await Promise.allSettled([
      this.projectStore.loadById(this.projectId),
      this.taskStore.loadForProject(this.projectId),
      this.statusStore.loadForProject(this.projectId),
      this.labelStore.loadForProject(this.projectId),
      this.memberStore.loadForProject(this.projectId),
      this.loadProjectAnalytics(),
      this.loadPlanningItems(),
    ]);
  }

  private async loadProjectAnalytics(): Promise<void> {
    const { from, to } = this.analytics.lastNDays(30);
    const [velocity, burndown, lead, cycle, flow] = await Promise.allSettled([
      this.analytics.getProjectVelocity(this.projectId, from, to),
      this.analytics.getProjectBurndown(this.projectId, from, to),
      this.analytics.getProjectLeadTime(this.projectId, from, to),
      this.analytics.getProjectCycleTime(this.projectId, from, to),
      this.analytics.getProjectStatusFlow(this.projectId, from, to),
    ]);
    const velocityRows: Array<{ value: number }> = velocity.status === 'fulfilled' ? velocity.value : [];
    this.projectAnalytics.set({
      velocity: velocityRows.reduce((acc: number, row: { value: number }) => acc + Number(row.value ?? 0), 0),
      burndownPoints: burndown.status === 'fulfilled' ? burndown.value.length : 0,
      leadTimeBuckets: lead.status === 'fulfilled' ? lead.value.length : 0,
      cycleTimeBuckets: cycle.status === 'fulfilled' ? cycle.value.length : 0,
      statusFlowEdges: flow.status === 'fulfilled' ? flow.value.length : 0,
    });
  }

  private async loadPlanningItems(): Promise<void> {
    try {
      this.planningItems.set(await this.planningApi.list(this.projectId));
    } catch {
      this.planningError.set('No se pudo cargar la planificación del proyecto.');
    }
  }

  async createPlanningItem(type: PlanningItemType): Promise<void> {
    const names = { epic: this.newEpicName, sprint: this.newSprintName, release: this.newReleaseName };
    const name = names[type].trim();
    if (!name) {
      this.planningError.set(`Completá el nombre de la ${type === 'release' ? 'release' : type}.`);
      this.toast.error('Falta el nombre del elemento de planificación');
      return;
    }
    const body: CreatePlanningItemBody = { type, name };
    if (type === 'sprint') {
      body.startDate = this.newSprintStartDate || null;
      body.endDate = this.newSprintEndDate || null;
    }
    if (type === 'release') body.endDate = this.newReleaseDate || null;
    this.planningError.set(null);
    try {
      const created = await this.planningApi.create(this.projectId, body);
      this.planningItems.update(items => [...items, created]);
      if (type === 'epic') this.newEpicName = '';
      if (type === 'sprint') {
        this.newSprintName = '';
        this.newSprintStartDate = '';
        this.newSprintEndDate = '';
      }
      if (type === 'release') {
        this.newReleaseName = '';
        this.newReleaseDate = '';
      }
      this.toast.success('Elemento de planificación creado');
    } catch {
      this.planningError.set('No se pudo crear la épica, sprint o release.');
      this.toast.error('No se pudo crear el elemento de planificación');
    }
  }

  async assignPlanning(task: Task, field: 'epicId' | 'sprintId' | 'releaseId', value: string): Promise<void> {
    this.planningError.set(null);
    try {
      const updated = await this.taskApi.update(this.projectId, task.id, {
        [field]: value || null,
      });
      this.taskStore.upsert(updated);
    } catch {
      this.planningError.set('No se pudo vincular el issue con la planificación.');
      this.toast.error('No se pudo actualizar la planificación del issue');
    }
  }

  async createStatus(): Promise<void> {
    const name = this.newStatusName.trim();
    if (!name) return;
    this.savingWorkflow.set(true);
    this.workflowError.set(null);
    try {
      const status = await this.statusApi.create(this.projectId, {
        name,
        category: this.newStatusCategory,
        order: this.workflowStatuses().length,
      });
      this.statusStore.upsert(status);
      this.newStatusName = '';
    } catch {
      this.workflowError.set('No se pudo crear el estado.');
    } finally {
      this.savingWorkflow.set(false);
    }
  }

  editStatus(status: WorkflowStatus): void {
    this.editingStatusId.set(status.id);
    this.editStatusName = status.name;
    this.editStatusCategory = status.category;
  }

  async saveStatus(status: WorkflowStatus): Promise<void> {
    const name = this.editStatusName.trim();
    if (!name) return;
    this.workflowError.set(null);
    try {
      const updated = await this.statusApi.update(status.id, {
        name,
        category: this.editStatusCategory,
      });
      this.statusStore.upsert(updated);
      this.editingStatusId.set(null);
    } catch {
      this.workflowError.set('No se pudo actualizar el estado.');
    }
  }

  async moveStatus(status: WorkflowStatus, direction: -1 | 1): Promise<void> {
    const statuses = this.workflowStatuses();
    const index = statuses.findIndex(current => current.id === status.id);
    const target = statuses[index + direction];
    if (index < 0 || !target) return;
    this.workflowError.set(null);
    try {
      const [currentUpdated, targetUpdated] = await Promise.all([
        this.statusApi.update(status.id, { order: target.order }),
        this.statusApi.update(target.id, { order: status.order }),
      ]);
      this.statusStore.upsert(currentUpdated);
      this.statusStore.upsert(targetUpdated);
    } catch {
      this.workflowError.set('No se pudo reordenar el workflow.');
    }
  }

  async deleteStatus(status: WorkflowStatus): Promise<void> {
    const replacementId = this.deleteReplacementByStatus[status.id];
    if (!replacementId) return;
    this.workflowError.set(null);
    try {
      await this.statusApi.delete(status.id, replacementId);
      this.statusStore.remove(status.id);
      delete this.deleteReplacementByStatus[status.id];
    } catch {
      this.workflowError.set('No se pudo eliminar el estado.');
    }
  }

}
