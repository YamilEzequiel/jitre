import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AiUsagePoint,
  AnalyticsPeriodPoint,
  AnalyticsService,
  WorkloadBucket,
} from '../../core/analytics/analytics.service';
import { AuthService } from '../../core/auth/auth.service';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { VelocityChartComponent, type TimeSeriesPoint } from './velocity-chart.component';
import { WorkloadChartComponent, type WorkloadPoint } from './workload-chart.component';
import { AiConsumptionChartComponent } from './ai-consumption-chart.component';

@Component({
  selector: 'jt-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SkeletonComponent,
    VelocityChartComponent,
    WorkloadChartComponent,
    AiConsumptionChartComponent,
  ],
  template: `
    <div class="space-y-6 max-w-7xl">
      <header class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="space-y-2">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-200 bg-blue-50">
              <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Insights</span>
            </div>
            <h1 class="text-3xl sm:text-4xl font-black tracking-tight text-slate-950">
              Analytics de workspace
            </h1>
            <p class="max-w-2xl text-sm text-slate-600">
              Velocidad, throughput, carga del equipo y consumo de IA con datos reales del backend.
            </p>
          </div>

          <div class="flex gap-2" role="group" aria-label="Date range">
            @for (option of rangeOptions; track option.days) {
              <button
                [class]="
                  'px-3 py-2 text-xs font-bold rounded-full transition-all ' +
                  (rangeDays() === option.days
                    ? 'text-white bg-blue-700 shadow-md shadow-blue-500/25 border border-blue-700'
                    : 'text-slate-600 bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700')
                "
                (click)="setRange(option.days)"
                [attr.aria-pressed]="rangeDays() === option.days"
              >
                {{ option.label }}
              </button>
            }
          </div>
        </div>
      </header>

      @if (errorMessage()) {
        <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {{ errorMessage() }}
        </div>
      }

      @if (loading()) {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          @for (i of [1, 2, 3, 4]; track i) {
            <jt-skeleton variant="card" />
          }
        </div>
      } @else {
        <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Velocity</p>
            <p class="mt-2 text-3xl font-black text-slate-950">{{ totalVelocity() }}</p>
            <p class="text-xs text-slate-500">tareas completadas</p>
          </article>
          <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Throughput</p>
            <p class="mt-2 text-3xl font-black text-slate-950">{{ totalThroughput() }}</p>
            <p class="text-xs text-slate-500">movimientos a done</p>
          </article>
          <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workload</p>
            <p class="mt-2 text-3xl font-black text-slate-950">{{ totalWorkload() }}</p>
            <p class="text-xs text-slate-500">tareas abiertas asignadas</p>
          </article>
          <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">AI</p>
            <p class="mt-2 text-3xl font-black text-slate-950">{{ totalAiRequests() }}</p>
            <p class="text-xs text-slate-500">requests · USD {{ totalAiCost() }}</p>
          </article>
        </section>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 class="text-sm font-black text-slate-950">Velocity</h2>
                <p class="text-xs text-slate-500">Tareas completadas por día.</p>
              </div>
            </div>
            <jt-velocity-chart [data]="velocityData()" />
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
            <div class="mb-4">
              <h2 class="text-sm font-black text-slate-950">Throughput</h2>
              <p class="text-xs text-slate-500">Flujo real hacia estados finalizados.</p>
            </div>
            <jt-velocity-chart [data]="throughputData()" />
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
            <div class="mb-4">
              <h2 class="text-sm font-black text-slate-950">Workload</h2>
              <p class="text-xs text-slate-500">Carga actual por responsable.</p>
            </div>
            <jt-workload-chart [data]="workloadData()" />
          </section>

          @if (isAdmin()) {
            <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
              <div class="mb-4">
                <h2 class="text-sm font-black text-slate-950">AI Usage</h2>
                <p class="text-xs text-slate-500">Requests de IA por día.</p>
              </div>
              <jt-ai-consumption-chart [data]="aiChartData()" />
            </section>
          }
        </div>
      }
    </div>
  `,
})
export class AnalyticsComponent implements OnInit {
  private readonly analytics = inject(AnalyticsService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly rangeDays = signal(30);
  readonly errorMessage = signal<string | null>(null);

  readonly velocityData = signal<TimeSeriesPoint[]>([]);
  readonly throughputData = signal<TimeSeriesPoint[]>([]);
  readonly workloadData = signal<WorkloadPoint[]>([]);
  readonly aiChartData = signal<TimeSeriesPoint[]>([]);

  readonly totalVelocity = computed(() => sumValues(this.velocityData()));
  readonly totalThroughput = computed(() => sumValues(this.throughputData()));
  readonly totalWorkload = computed(() => this.workloadData().reduce((acc, p) => acc + p.count, 0));
  readonly totalAiRequests = computed(() => sumValues(this.aiChartData()));
  readonly totalAiCost = signal('0.00');

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  readonly rangeOptions = [
    { days: 7, label: '7d' },
    { days: 14, label: '14d' },
    { days: 30, label: '30d' },
    { days: 90, label: '90d' },
  ];

  loadPromise!: Promise<void>;

  ngOnInit(): void {
    this.loadPromise = this.load();
  }

  setRange(days: number): void {
    this.rangeDays.set(days);
    this.loadPromise = this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    const { from, to } = this.analytics.lastNDays(this.rangeDays());

    const requests = [
      this.analytics.getVelocity(from, to).then(data => this.velocityData.set(toTimeSeries(data))),
      this.analytics.getThroughput(from, to).then(data => this.throughputData.set(toTimeSeries(data))),
      this.analytics.getWorkload('assignee').then(data => this.workloadData.set(toWorkload(data))),
    ];

    if (this.isAdmin()) {
      requests.push(
        this.analytics.getAiUsage(from, to).then(raw => {
          const data = raw as AiUsagePoint[];
          this.aiChartData.set(toAiSeries(data));
          this.totalAiCost.set(sumAiCost(data));
        }),
      );
    } else {
      this.aiChartData.set([]);
      this.totalAiCost.set('0.00');
    }

    const results = await Promise.allSettled(requests);
    if (results.some(r => r.status === 'rejected')) {
      this.errorMessage.set('Algunos paneles no pudieron cargar. Revisá permisos o disponibilidad del backend.');
    }
    this.loading.set(false);
  }
}

function toTimeSeries(points: AnalyticsPeriodPoint[] | null | undefined): TimeSeriesPoint[] {
  return (points ?? []).map(p => ({ date: p.period, value: Number(p.value ?? 0) }));
}

function toWorkload(points: WorkloadBucket[] | null | undefined): WorkloadPoint[] {
  return (points ?? []).map(p => ({
    label: p.key === '__unassigned__' ? 'Sin asignar' : p.key,
    count: Number(p.count ?? 0),
  }));
}

function toAiSeries(points: AiUsagePoint[] | null | undefined): TimeSeriesPoint[] {
  return (points ?? []).map(p => ({ date: p.period, value: Number(p.requests ?? 0) }));
}

function sumValues(points: TimeSeriesPoint[]): number {
  return points.reduce((acc, p) => acc + Number(p.value ?? 0), 0);
}

function sumAiCost(points: AiUsagePoint[] | null | undefined): string {
  const total = (points ?? []).reduce((acc, p) => acc + Number(p.costUsd ?? 0), 0);
  return total.toFixed(2);
}
