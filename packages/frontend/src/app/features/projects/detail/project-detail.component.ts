import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
import {
  WorkflowStatusApiService,
  StatusCategory,
  WorkflowStatus,
} from '../../../stores/workflow-status-api.service';

type ProjectTab = 'tasks' | 'backlog' | 'roadmap' | 'members' | 'analytics' | 'settings';
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
    FormsModule,
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
              (click)="activeTab.set(tab.value)"
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
                  <div class="space-y-2 rounded-2xl border border-slate-200 bg-white p-2">
                    <jt-task-card [task]="task" variant="row" (selected)="openTask($event)" />
                    <div class="flex flex-wrap justify-end gap-2 px-2 pb-2">
                      <select [ngModel]="task.epicId ?? ''" (ngModelChange)="assignPlanning(task, 'epicId', $event)" class="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700">
                        <option value="">Sin épica</option>
                        @for (epic of epics(); track epic.id) {
                          <option [value]="epic.id">{{ epic.name }}</option>
                        }
                      </select>
                      <select [ngModel]="task.sprintId ?? ''" (ngModelChange)="assignPlanning(task, 'sprintId', $event)" class="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700">
                        <option value="">Backlog</option>
                        @for (sprint of sprints(); track sprint.id) {
                          <option [value]="sprint.id">{{ sprint.name }}</option>
                        }
                      </select>
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
                    <select [ngModel]="task.releaseId ?? ''" (ngModelChange)="assignPlanning(task, 'releaseId', $event)" class="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700">
                      <option value="">Sin release</option>
                      @for (release of releases(); track release.id) {
                        <option [value]="release.id">{{ release.name }}</option>
                      }
                    </select>
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
                  <h2 class="mt-1 text-xl font-black text-slate-950">Últimos 30 días</h2>
                  <p class="text-sm text-slate-500">Métricas reales del proyecto para acompañar entregas y flujo.</p>
                </div>
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div class="rounded-2xl border border-slate-200 bg-white p-4">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Velocity</p>
                    <p class="mt-2 text-2xl font-black text-slate-950">{{ projectAnalytics().velocity }}</p>
                  </div>
                  <div class="rounded-2xl border border-slate-200 bg-white p-4">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Burndown</p>
                    <p class="mt-2 text-2xl font-black text-slate-950">{{ projectAnalytics().burndownPoints }}</p>
                    <p class="text-xs text-slate-500">puntos</p>
                  </div>
                  <div class="rounded-2xl border border-slate-200 bg-white p-4">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lead time</p>
                    <p class="mt-2 text-2xl font-black text-slate-950">{{ projectAnalytics().leadTimeBuckets }}</p>
                    <p class="text-xs text-slate-500">períodos</p>
                  </div>
                  <div class="rounded-2xl border border-slate-200 bg-white p-4">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cycle time</p>
                    <p class="mt-2 text-2xl font-black text-slate-950">{{ projectAnalytics().cycleTimeBuckets }}</p>
                    <p class="text-xs text-slate-500">períodos</p>
                  </div>
                  <div class="rounded-2xl border border-slate-200 bg-white p-4">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status flow</p>
                    <p class="mt-2 text-2xl font-black text-slate-950">{{ projectAnalytics().statusFlowEdges }}</p>
                    <p class="text-xs text-slate-500">transiciones</p>
                  </div>
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
                          <select [(ngModel)]="editStatusCategory" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950">
                            <option value="todo">To do</option>
                            <option value="in_progress">In progress</option>
                            <option value="done">Done</option>
                          </select>
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
                            <select
                              [ngModel]="deleteReplacementByStatus[status.id] ?? ''"
                              (ngModelChange)="deleteReplacementByStatus[status.id] = $event"
                              class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                            >
                              <option value="">Elegir reemplazo</option>
                              @for (replacement of workflowStatuses(); track replacement.id) {
                                @if (replacement.id !== status.id) {
                                  <option [value]="replacement.id">{{ replacement.name }}</option>
                                }
                              }
                            </select>
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
                  <select [(ngModel)]="newStatusCategory" class="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-500">
                    <option value="todo">To do</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
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

  readonly activeTab = signal<ProjectTab>('tasks');
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

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    this.taskView.set(this.loadViewPreference());
    void this.loadProjectContext();
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
