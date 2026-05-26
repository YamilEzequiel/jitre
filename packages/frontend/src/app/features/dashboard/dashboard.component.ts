import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaskStore } from '../../stores/task.store';
import { ProjectStore } from '../../stores/project.store';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';

interface WorkspaceStats {
  totalTasks: number;
  completedTasks: number;
  openProjects: number;
  teamMembers: number;
}

@Component({
  selector: 'jt-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SkeletonComponent],
  template: `
    <div class="mx-auto max-w-[70rem] space-y-5 text-slate-950">
      <header class="relative overflow-hidden rounded-2xl border border-slate-100 bg-white px-6 py-6 shadow-sm shadow-slate-200/70">
        <div class="pointer-events-none absolute right-12 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full bg-violet-50" aria-hidden="true"></div>
        <div class="relative space-y-3">
        <div
          class="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1"
        >
          <span
            class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"
            aria-hidden="true"
          ></span>
          <span
            class="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600"
          >
            Live workspace
          </span>
        </div>
        <h1 class="text-base font-bold leading-tight tracking-tight text-slate-600">
          <span class="block">Welcome back to your</span>
          <span
            class="block bg-gradient-to-r from-indigo-500 to-violet-500
                   bg-clip-text text-transparent"
          >
            command center.
          </span>
        </h1>
        <p class="max-w-md text-sm text-slate-500">
          Tasks, projects and analytics &mdash; at a glance. Press
          <kbd
            class="inline-flex items-center gap-0.5 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"
          >&#8984;K</kbd>
          to jump anywhere.
        </p>
        </div>
      </header>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        @if (statsLoading()) {
          @for (i of [1, 2, 3, 4]; track i) {
            <jt-skeleton variant="card" />
          }
        } @else {
          <div
            class="group relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 transition-all hover:border-violet-200"
          >
            <div class="mb-3 flex items-center justify-between">
              <p class="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Total Tasks</p>
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-500"
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
                  <path d="M11 17H7A5 5 0 0 1 7 7h4" />
                  <path d="M13 7h4a5 5 0 1 1 0 10h-4" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
            </div>
            <p
              class="text-4xl font-black tracking-tight text-slate-950"
            >
              {{ stats()?.totalTasks ?? '-' }}
            </p>
          </div>
          <div
            class="group relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 transition-all hover:border-emerald-200"
          >
            <div class="mb-3 flex items-center justify-between">
              <p class="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Completed</p>
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-500"
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
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
            </div>
            <p
              class="text-4xl font-black tracking-tight text-slate-950"
            >
              {{ stats()?.completedTasks ?? '-' }}
            </p>
          </div>
          <div
            class="group relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 transition-all hover:border-fuchsia-200"
          >
            <div class="mb-3 flex items-center justify-between">
              <p class="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Open Projects</p>
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-100 text-fuchsia-500"
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
                  <path d="M20 7h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
                </svg>
              </div>
            </div>
            <p
              class="text-4xl font-black tracking-tight text-slate-950"
            >
              {{ stats()?.openProjects ?? '-' }}
            </p>
          </div>
          <div
            class="group relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 transition-all hover:border-orange-200"
          >
            <div class="mb-3 flex items-center justify-between">
              <p class="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Team Members</p>
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-500"
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
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
            </div>
            <p
              class="text-4xl font-black tracking-tight text-slate-950"
            >
              {{ stats()?.teamMembers ?? '-' }}
            </p>
          </div>
        }
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-[1.04fr_1.12fr_1fr]">
        <div
          class="min-h-[15rem] rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60"
        >
          <header class="mb-4 flex items-center justify-between">
            <h2
              class="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400"
            >
              Recent Projects
            </h2>
            <a routerLink="/projects" class="text-xs font-semibold text-indigo-500 hover:text-indigo-700">View all</a>
          </header>
          @if (projectStore.loading()) {
            <div class="space-y-3">
              <jt-skeleton variant="text" />
              <jt-skeleton variant="text" />
              <jt-skeleton variant="text" />
            </div>
          } @else if (projectStore.items().length === 0) {
            <p class="text-sm text-slate-500">No projects yet.</p>
          } @else {
            <ul class="space-y-2.5">
              @for (project of projectStore.items().slice(0, 5); track $index) {
                <li class="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm text-slate-700">
                  <span class="h-2 w-2 rounded-full bg-violet-500" aria-hidden="true"></span>
                  <span class="min-w-0 flex-1 truncate font-semibold">{{ project.name }}</span>
                  <i class="pi pi-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
                </li>
              }
            </ul>
          }
        </div>

        <div
          class="flex min-h-[15rem] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60"
        >
          <header class="mb-4 flex items-center justify-between">
            <h2
              class="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400"
            >
              Recent Activity
            </h2>
          </header>
          @if (taskStore.loading()) {
            <div class="space-y-3">
              <jt-skeleton variant="text" />
              <jt-skeleton variant="text" />
            </div>
          } @else {
            <div class="flex flex-1 flex-col items-center justify-center text-center">
              <span class="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                <i class="pi pi-history" aria-hidden="true"></i>
              </span>
              <p class="text-sm font-semibold text-slate-400">No recent activity</p>
              <p class="mt-2 max-w-[13rem] text-xs leading-relaxed text-slate-400">Your actions and events will appear here once you start working.</p>
            </div>
          }
        </div>

        <div
          class="min-h-[15rem] rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60"
        >
          <header class="mb-6 flex items-center justify-between">
            <h2
              class="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400"
            >
              Analytics Summary
            </h2>
            <i class="pi pi-chart-line text-slate-300" aria-hidden="true"></i>
          </header>
          @if (statsLoading()) {
            <jt-skeleton variant="text" />
          } @else {
            <div class="space-y-4">
              <div class="flex items-end justify-between">
                <p class="text-xl font-black text-slate-950">{{ stats()?.completedTasks }} <span class="text-sm text-slate-500">of {{ stats()?.totalTasks }}</span></p>
                <p class="text-xs font-semibold text-slate-400">{{ completionPercent() }}%</p>
              </div>
              <p class="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Tasks completed</p>
              <div class="h-2 rounded-full bg-slate-100">
                <div class="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" [style.width.%]="completionPercent()"></div>
              </div>
              <div class="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3">
                <p class="text-xs font-semibold text-indigo-600">✧ Insight</p>
                <p class="mt-1 text-xs leading-relaxed text-indigo-500">Complete one more task to keep momentum visible to your team.</p>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly taskStore = inject(TaskStore);
  readonly projectStore = inject(ProjectStore);
  private readonly analytics = inject(AnalyticsService);

  readonly statsLoading = signal<boolean>(true);
  readonly stats = signal<WorkspaceStats | null>(null);
  readonly completionPercent = computed(() => {
    const stats = this.stats();
    if (!stats?.totalTasks) return 0;
    return Math.round((stats.completedTasks / stats.totalTasks) * 100);
  });

  statsPromise!: Promise<void>;

  ngOnInit(): void {
    this.statsPromise = this.analytics
      .getWorkspaceStats()
      .then(s => {
        this.stats.set(s as WorkspaceStats);
        this.statsLoading.set(false);
      })
      .catch(() => {
        this.statsLoading.set(false);
      });
  }
}
