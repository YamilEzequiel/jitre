import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import type { ChartConfiguration } from 'chart.js';
import { ChartComponent } from './chart.component';
import { AuthService } from '../../core/auth/auth.service';
import type { TimeSeriesPoint } from './velocity-chart.component';

@Component({
  selector: 'jt-ai-consumption-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartComponent],
  template: `
    @if (isAdmin()) {
      <div class="w-full h-48">
        <jt-chart
          chartType="line"
          [chartData]="chartData()"
          [chartOptions]="chartOptions"
          ariaLabel="AI consumption chart"
        />
      </div>
    }
  `,
})
export class AiConsumptionChartComponent {
  private readonly auth = inject(AuthService);

  readonly data = input<TimeSeriesPoint[]>([]);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  readonly chartData = computed<ChartConfiguration['data']>(() => ({
    labels: this.data().map(p => p.date),
    datasets: [
      {
        label: 'AI Credits Used',
        data: this.data().map(p => p.value),
        borderColor: 'rgba(245, 158, 11, 1)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.3,
      },
    ],
  }));

  readonly chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };
}
