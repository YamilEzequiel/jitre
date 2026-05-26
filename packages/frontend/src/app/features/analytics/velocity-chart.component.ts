import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { ChartConfiguration } from 'chart.js';
import { ChartComponent } from './chart.component';

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

@Component({
  selector: 'jt-velocity-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartComponent],
  template: `
    <div class="w-full h-48">
      <jt-chart
        chartType="bar"
        [chartData]="chartData()"
        [chartOptions]="chartOptions"
        ariaLabel="Velocity chart"
      />
    </div>
  `,
})
export class VelocityChartComponent {
  readonly data = input<TimeSeriesPoint[]>([]);

  readonly chartData = computed<ChartConfiguration['data']>(() => ({
    labels: this.data().map(p => p.date),
    datasets: [
      {
        label: 'Velocity',
        data: this.data().map(p => p.value),
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 1,
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
