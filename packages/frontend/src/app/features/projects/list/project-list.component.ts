import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ProjectStore } from '../../../stores/project.store';
import { Project } from '../../../stores/project-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { SkeletonComponent } from '../../../shared/skeleton/skeleton.component';
import { CreateProjectComponent } from '../create/create-project.component';

type StatusFilter = 'all' | 'active' | 'archived';

@Component({
  selector: 'jt-project-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, CreateProjectComponent],
  template: `
    <div class="flex flex-col h-full max-w-7xl">
      <!-- Header -->
      <header class="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div class="space-y-3">
          <div
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full
                   border border-blue-200 bg-blue-50 backdrop-blur-sm"
          >
            <span
              class="text-[10px] font-bold uppercase tracking-[0.18em]
                     bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300
                     bg-clip-text text-transparent"
            >
              Workspace · Projects
            </span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-black tracking-tight">
            <span class="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent">
              Projects
            </span>
          </h1>
        </div>
        <button
          type="button"
          (click)="openCreate()"
          [disabled]="!workspaceId()"
          class="group inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white
                 bg-gradient-to-r from-indigo-600 to-violet-600
                 shadow-md shadow-indigo-500/25
                 hover:shadow-lg hover:shadow-indigo-500/40
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                 transition-shadow disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            class="h-4 w-4"
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
          New Project
        </button>
      </header>

      <!-- Status filter chips -->
      <div class="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by status">
        @for (s of statusOptions; track s.value) {
          <button
            [class]="
              'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all backdrop-blur-sm ' +
              (statusFilter() === s.value
                ? 'text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/25 border border-transparent'
                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 hover:border-slate-300')
            "
            (click)="statusFilter.set(s.value)"
            [attr.aria-pressed]="statusFilter() === s.value"
          >
            {{ s.label }}
          </button>
        }
      </div>

      <!-- Project list -->
      @if (store.loading()) {
        <div class="space-y-3">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <jt-skeleton variant="card" />
          }
        </div>
      } @else {
        <div class="flex-1 overflow-auto pr-1">
          <div class="space-y-3">
            @for (project of filteredProjects(); track project.id) {
              <div
                class="group flex items-center justify-between gap-4 rounded-2xl
                       border border-slate-200 bg-white p-4 sm:p-5
                       shadow-lg shadow-slate-200/80
                       hover:border-slate-300 hover:bg-slate-50
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                       focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                       cursor-pointer transition-colors"
                (click)="navigateToProject(project.id)"
                role="button"
                [attr.aria-label]="'Open project ' + project.name"
                tabindex="0"
                (keydown.enter)="navigateToProject(project.id)"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div
                    class="flex h-11 w-11 flex-none items-center justify-center rounded-xl
                           bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20"
                  >
                    <svg
                      class="h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 7h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-slate-950 truncate group-hover:text-violet-700">
                      {{ project.name }}
                    </p>
                    <p class="text-xs text-slate-500 truncate">{{ project.key }}</p>
                  </div>
                </div>
                <span
                  [class]="
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] border backdrop-blur-sm ' +
                    (project.status === 'active'
                      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                      : 'text-slate-500 bg-white border-slate-200')
                  "
                >
                  <span
                    [class]="
                      'h-1.5 w-1.5 rounded-full ' +
                      (project.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500')
                    "
                    aria-hidden="true"
                  ></span>
                  {{ project.status }}
                </span>
              </div>
            } @empty {
              <div
                class="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center"
              >
                <p class="text-sm text-slate-500">No projects found.</p>
              </div>
            }
          </div>
        </div>
      }
    </div>

    <!-- Create project modal -->
    @if (showCreate() && workspaceId()) {
      <div
        class="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[2px] md:pl-[19.5rem]"
        role="dialog"
        aria-modal="true"
        aria-label="Create project"
        (click)="closeCreate()"
        (keydown.escape)="closeCreate()"
      >
        <div class="h-full w-full max-w-[88rem] bg-white shadow-2xl shadow-slate-950/20" (click)="$event.stopPropagation()">
          <jt-create-project
            [workspaceId]="workspaceId()!"
            (created)="onCreated($event)"
            (cancelled)="closeCreate()"
          />
        </div>
      </div>
    }
  `,
})
export class ProjectListComponent {
  readonly store = inject(ProjectStore);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly statusFilter = signal<StatusFilter>('all');
  readonly showCreate = signal(false);

  readonly workspaceId = computed(() => this.auth.currentWorkspace()?.id ?? null);

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ];

  readonly filteredProjects = computed<Project[]>(() => {
    const filter = this.statusFilter();
    const items = this.store.items() as Project[];
    if (filter === 'all') return items;
    return items.filter(p => p.status === filter);
  });

  navigateToProject(id: string): void {
    this.router.navigate(['/projects', id]);
  }

  openCreate(): void {
    this.showCreate.set(true);
  }

  closeCreate(): void {
    this.showCreate.set(false);
  }

  onCreated(project: Project): void {
    this.store.upsert(project);
    this.closeCreate();
  }
}
