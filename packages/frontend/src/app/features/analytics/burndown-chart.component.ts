import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { ChartConfiguration } from 'chart.js';
import { ChartComponent } from './chart.component';
import type { TimeSeriesPoint } from './velocity-chart.component';

@Component({
  selector: 'jt-burndown-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartComponent],
  template: `
    <div class="w-full h-48">
      <jt-chart
        chartType="line"
        [chartData]="chartData()"
        [chartOptions]="chartOptions"
        ariaLabel="Burndown chart"
      />
    </div>
  `,
})
export class BurndownChartComponent {
  readonly data = input<TimeSeriesPoint[]>([]);

  readonly chartData = computed<ChartConfiguration['data']>(() => ({
    labels: this.data().map(p => p.date),
    datasets: [
      {
        label: 'Remaining',
        data: this.data().map(p => p.value),
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
      x: { type: 'category' },
      y: { beginAtZero: true },
    },
  };
}
