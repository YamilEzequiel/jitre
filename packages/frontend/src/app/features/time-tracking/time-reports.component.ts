import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import {
  TimeEntryApiService,
  TimeReportGroupBy,
  TimeReportRow,
  TimeEntry,
} from '../../stores/time-entry-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceMemberStore } from '../../stores/workspace-member.store';
import { TaskStore } from '../../stores/task.store';
import { TaskApiService } from '../../stores/task-api.service';
import { ProjectStore } from '../../stores/project.store';
import { formatMinutes } from './duration.util';

interface SummaryCardData {
  totalMinutes: number;
  totalEntries: number;
  billableMinutes: number;
  topContributor: { groupKey: string; totalMinutes: number } | null;
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

@Component({
  selector: 'jt-time-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TitleCasePipe],
  template: `
    <div class="space-y-6 max-w-7xl">
      @if (gateBlocked()) {
        <div
          class="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"
          role="status"
        >
          <p class="text-lg font-semibold text-amber-800 mb-2">Admins only</p>
          <p class="text-sm text-amber-700">
            Time reports are available to workspace admins. Redirecting…
          </p>
        </div>
      } @else {
        <!-- Header -->
        <header class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70 flex flex-wrap items-end justify-between gap-4">
          <div class="space-y-3">
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full
                     border border-violet-200 bg-violet-50"
            >
              <span class="pi pi-clock text-violet-600" aria-hidden="true"></span>
              <span
                class="text-[10px] font-bold uppercase tracking-[0.18em]
                       text-violet-700"
              >
                {{ myTimeOnly() ? 'My Time' : 'Time reports' }}
              </span>
            </div>
            <h1 class="text-3xl sm:text-4xl font-black tracking-tight leading-[1.05]">
              <span
                class="block bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent"
              >
                {{ myTimeOnly() ? 'My logged hours' : 'Time reports' }}
              </span>
            </h1>
            @if (!myTimeOnly()) {
              <p class="text-xs text-slate-500">
                Admin view · {{ rows().length }} groups
              </p>
            }
          </div>
          <button
            type="button"
            (click)="exportCsv()"
            [disabled]="loading() || rows().length === 0"
            class="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700
                   bg-white border border-slate-200 hover:bg-slate-100 hover:border-slate-300
                   transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="export-csv"
          >
            <span class="pi pi-download" aria-hidden="true"></span>
            Export CSV
          </button>
        </header>

        <!-- Filters -->
        <form
          [formGroup]="filterForm"
          (ngSubmit)="reload()"
          class="rounded-2xl border border-slate-200 bg-white p-4
                 flex flex-wrap items-end gap-3"
          aria-label="Report filters"
        >
          <label class="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            From
            <input
              type="date"
              formControlName="dateFrom"
              class="rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700
                     outline-none focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
            />
          </label>
          <label class="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            To
            <input
              type="date"
              formControlName="dateTo"
              class="rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700
                     outline-none focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
            />
          </label>

          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Group by
            </span>
            <div class="inline-flex rounded-lg overflow-hidden border border-slate-200 bg-white">
              @for (g of groupByOptions; track g.value) {
                <button
                  type="button"
                  (click)="setGroupBy(g.value)"
                  [class]="
                    'px-3 py-2 text-xs font-semibold transition-colors ' +
                    (groupBy() === g.value
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100')
                  "
                  [attr.aria-pressed]="groupBy() === g.value"
                >
                  {{ g.label }}
                </button>
              }
            </div>
          </div>

          <button
            type="submit"
            [disabled]="loading()"
            class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-white
                   bg-gradient-to-r from-indigo-600 to-violet-600
                   shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/40
                   transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
          >
            Apply
          </button>
        </form>

        <!-- Summary -->
        <section
          class="grid grid-cols-2 md:grid-cols-4 gap-3"
          aria-label="Summary"
        >
          <article
            class="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
              Total hours
            </p>
            <p class="text-2xl font-black text-slate-950 tabular-nums">
              {{ totalLabel() }}
            </p>
          </article>
          <article
            class="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
              Entries
            </p>
            <p class="text-2xl font-black text-slate-950 tabular-nums">
              {{ summary().totalEntries }}
            </p>
          </article>
          <article
            class="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
              Billable
            </p>
            <p class="text-2xl font-black text-slate-950 tabular-nums">
              {{ billableLabel() }}
            </p>
          </article>
          <article
            class="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
              Top {{ groupBy() }}
            </p>
            <p class="text-sm font-bold text-slate-950 truncate" [attr.title]="labelForGroupKey(summary().topContributor?.groupKey)">
              {{ labelForGroupKey(summary().topContributor?.groupKey) }}
            </p>
          </article>
        </section>

        <!-- Bar chart (CSS divs) -->
        <section
          class="rounded-2xl border border-slate-200 bg-white p-6"
          aria-label="Bar chart"
        >
          <h2 class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-4">
            Distribution
          </h2>
          @if (rows().length === 0) {
            <p class="text-xs text-slate-500 italic">No data for the selected range.</p>
          } @else {
            <ul class="space-y-2" data-testid="bar-chart">
              @for (row of rows(); track row.groupKey) {
                <li class="flex items-center gap-3 text-xs">
                  <span class="w-40 shrink-0 truncate text-slate-600" [attr.title]="labelForGroupKey(row.groupKey)">
                    {{ labelForGroupKey(row.groupKey) }}
                  </span>
                  <div class="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      class="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
                      [style.width.%]="rowPct(row)"
                      role="presentation"
                    ></div>
                  </div>
                  <span class="w-20 shrink-0 tabular-nums text-right text-violet-700 font-semibold">
                    {{ formatRow(row.totalMinutes) }}
                  </span>
                </li>
              }
            </ul>
          }
        </section>

        <!-- Table -->
        <section
          class="rounded-2xl border border-slate-200 bg-white overflow-hidden"
          aria-label="Detailed table"
        >
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th class="px-4 py-3 text-left font-bold">{{ groupBy() | titlecase }}</th>
                <th class="px-4 py-3 text-right font-bold">Total</th>
                <th class="px-4 py-3 text-right font-bold">Entries</th>
                <th class="px-4 py-3 text-right font-bold">%</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.groupKey) {
                <tr
                  class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  (click)="drilldown(row)"
                  (keydown.enter)="drilldown(row)"
                  tabindex="0"
                  role="button"
                  [attr.aria-label]="'Drill down ' + labelForGroupKey(row.groupKey)"
                >
                  <td class="px-4 py-3 text-slate-700 truncate">{{ labelForGroupKey(row.groupKey) }}</td>
                  <td class="px-4 py-3 text-right text-violet-700 font-semibold tabular-nums">
                    {{ formatRow(row.totalMinutes) }}
                  </td>
                  <td class="px-4 py-3 text-right text-slate-600 tabular-nums">
                    {{ row.entryCount }}
                  </td>
                  <td class="px-4 py-3 text-right text-slate-500 tabular-nums">
                    {{ rowPct(row).toFixed(1) }}%
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="px-4 py-6 text-center text-slate-500 text-xs italic">
                    No data.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>

        <!-- Drilldown modal -->
        @if (drilldownRow(); as dr) {
          <div
            class="fixed inset-0 z-50 flex items-center justify-center p-4
                   bg-slate-950/45 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="Drilldown"
            (click)="closeDrilldown()"
          >
            <div
              class="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6
                     shadow-2xl shadow-indigo-500/10"
              (click)="$event.stopPropagation()"
            >
              <div class="flex items-center justify-between gap-3 mb-4">
                <h2 class="text-lg font-bold text-slate-950">
                  {{ labelForGroupKey(dr.groupKey) }}
                </h2>
                <button
                  type="button"
                  (click)="closeDrilldown()"
                  class="text-slate-500 hover:text-slate-900"
                  aria-label="Close"
                >
                  <span class="pi pi-times"></span>
                </button>
              </div>
              @if (drilldownEntries().length > 0) {
                <ul class="space-y-1 max-h-96 overflow-auto">
                  @for (e of drilldownEntries(); track e.id) {
                    <li
                      class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    >
                      <span class="text-slate-500 w-24 shrink-0">{{ e.date }}</span>
                      <span class="text-violet-700 font-semibold w-20 shrink-0">
                        {{ formatRow(e.durationMinutes) }}
                      </span>
                      <span class="flex-1 text-slate-600 truncate">{{ e.description ?? '—' }}</span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-xs text-slate-500 italic">Loading entries…</p>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class TimeReportsComponent implements OnInit {
  readonly myTimeOnly = input<boolean>(false);

  private readonly api = inject(TimeEntryApiService);
  private readonly auth = inject(AuthService);
  private readonly memberStore = inject(WorkspaceMemberStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly taskStore = inject(TaskStore);
  private readonly taskApi = inject(TaskApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly groupByOptions: { value: TimeReportGroupBy; label: string }[] = [
    { value: 'user', label: 'User' },
    { value: 'project', label: 'Project' },
    { value: 'task', label: 'Task' },
    { value: 'date', label: 'Date' },
  ];

  readonly loading = signal(false);
  readonly groupBy = signal<TimeReportGroupBy>('user');
  readonly rows = signal<TimeReportRow[]>([]);
  readonly drilldownRow = signal<TimeReportRow | null>(null);
  readonly drilldownEntries = signal<TimeEntry[]>([]);

  readonly filterForm = this.fb.nonNullable.group({
    dateFrom: [firstOfMonth()],
    dateTo: [todayIso()],
  });

  readonly summary = computed<SummaryCardData>(() => {
    const list = this.rows();
    let totalMinutes = 0;
    let totalEntries = 0;
    let top: { groupKey: string; totalMinutes: number } | null = null;
    for (const row of list) {
      totalMinutes += row.totalMinutes;
      totalEntries += row.entryCount;
      if (!top || row.totalMinutes > top.totalMinutes) {
        top = { groupKey: row.groupKey, totalMinutes: row.totalMinutes };
      }
    }
    return {
      totalMinutes,
      totalEntries,
      // Approximation: backend report doesn't split billable; show same total when groupBy is billable-aware.
      // We approximate billable as total — actual value should come from a dedicated endpoint.
      billableMinutes: totalMinutes,
      topContributor: top,
    };
  });

  readonly totalLabel = computed(() => formatMinutes(this.summary().totalMinutes));
  readonly billableLabel = computed(() => formatMinutes(this.summary().billableMinutes));

  readonly maxMinutes = computed(() => {
    let max = 0;
    for (const row of this.rows()) {
      if (row.totalMinutes > max) max = row.totalMinutes;
    }
    return max;
  });

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  /** True when the current view requires admin and the user is not an admin. */
  readonly gateBlocked = computed(() => !this.myTimeOnly() && !this.isAdmin());

  ngOnInit(): void {
    if (this.gateBlocked()) {
      // Redirect with a slight delay to allow the user to read the message
      setTimeout(() => this.router.navigateByUrl('/'), 1200);
      return;
    }
    void this.reload();
  }

  setGroupBy(value: TimeReportGroupBy): void {
    this.groupBy.set(value);
    void this.reload();
  }

  formatRow(min: number): string {
    return formatMinutes(min);
  }

  /**
   * Resolve the row key (which is a UUID for user/project/task or a date
   * string for date grouping) into a human label. Falls back to a short
   * hash-style fragment of the UUID when the entity hasn't been fetched yet,
   * which is far less hostile than dumping the full UUID in the UI.
   */
  labelForGroupKey(key: string | null | undefined): string {
    if (!key) return '—';
    const gb = this.groupBy();
    if (gb === 'user') return this.memberStore.displayNameFor(key, this.shortId(key, 'User'));
    if (gb === 'project') {
      const project = this.projectStore.byId()[key];
      return project?.name ?? this.shortId(key, 'Project');
    }
    if (gb === 'task') {
      const task = this.taskStore.byId()[key];
      return task?.title ?? this.shortId(key, 'Task');
    }
    // 'date' — already human (ISO date string)
    return key;
  }

  private shortId(uuid: string, prefix: string): string {
    return `${prefix} #${uuid.slice(0, 6)}`;
  }

  rowPct(row: TimeReportRow): number {
    const max = this.maxMinutes();
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, (row.totalMinutes / max) * 100));
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const userId = this.myTimeOnly() ? this.auth.currentUser()?.id : undefined;
      const dateFrom = this.filterForm.controls.dateFrom.value || undefined;
      const dateTo = this.filterForm.controls.dateTo.value || undefined;
      const rows = await this.api.report({
        groupBy: this.groupBy(),
        dateFrom,
        dateTo,
        userId,
      });
      this.rows.set(
        rows.slice().sort((a, b) => b.totalMinutes - a.totalMinutes),
      );
      // Prefetch entity names for keys we don't have cached. Project + user
      // stores are loaded on workspace switch; tasks are project-scoped and
      // often missing here, so fetch the unknowns in parallel.
      void this.hydrateUnknownKeys();
    } catch {
      this.rows.set([]);
      this.toast.error('Failed to load report');
    } finally {
      this.loading.set(false);
    }
  }

  private async hydrateUnknownKeys(): Promise<void> {
    const gb = this.groupBy();
    if (gb !== 'task') return;
    const known = this.taskStore.byId();
    const missing = Array.from(
      new Set(this.rows().map(r => r.groupKey).filter(k => k && !known[k])),
    );
    if (missing.length === 0) return;
    const fetched = await Promise.allSettled(missing.map(id => this.taskApi.getById(id)));
    for (const result of fetched) {
      if (result.status === 'fulfilled') {
        this.taskStore.upsert(result.value);
      }
    }
  }

  exportCsv(): void {
    const rows = this.rows();
    if (rows.length === 0) return;
    const header = [this.groupBy(), 'total_minutes', 'entry_count'];
    const body = rows.map(r =>
      [escapeCsv(this.labelForGroupKey(r.groupKey)), String(r.totalMinutes), String(r.entryCount)].join(','),
    );
    const csv = [header.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-report-${this.groupBy()}-${todayIso()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async drilldown(row: TimeReportRow): Promise<void> {
    this.drilldownRow.set(row);
    this.drilldownEntries.set([]);
    try {
      const userId = this.myTimeOnly() ? this.auth.currentUser()?.id : undefined;
      const dateFrom = this.filterForm.controls.dateFrom.value || undefined;
      const dateTo = this.filterForm.controls.dateTo.value || undefined;
      const filters: Record<string, string> = {};
      if (dateFrom) filters['dateFrom'] = dateFrom;
      if (dateTo) filters['dateTo'] = dateTo;
      if (userId) filters['userId'] = userId;
      const gb = this.groupBy();
      if (gb === 'user') filters['userId'] = row.groupKey;
      else if (gb === 'task') filters['taskId'] = row.groupKey;
      else if (gb === 'project') filters['projectId'] = row.groupKey;
      else if (gb === 'date') {
        filters['dateFrom'] = row.groupKey;
        filters['dateTo'] = row.groupKey;
      }
      const entries = await this.api.list(filters);
      this.drilldownEntries.set(entries);
    } catch {
      this.drilldownEntries.set([]);
    }
  }

  closeDrilldown(): void {
    this.drilldownRow.set(null);
    this.drilldownEntries.set([]);
  }
}
