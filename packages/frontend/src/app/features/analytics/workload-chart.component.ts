import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { ChartConfiguration } from 'chart.js';
import { ChartComponent } from './chart.component';

export interface WorkloadPoint {
  label: string;
  count: number;
}

@Component({
  selector: 'jt-workload-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartComponent],
  template: `
    <div class="w-full h-48">
      <jt-chart
        chartType="bar"
        [chartData]="chartData()"
        [chartOptions]="chartOptions"
        ariaLabel="Workload chart"
      />
    </div>
  `,
})
export class WorkloadChartComponent {
  readonly data = input<WorkloadPoint[]>([]);

  readonly chartData = computed<ChartConfiguration['data']>(() => {
    const sorted = [...this.data()].sort((a, b) => b.count - a.count);
    return {
      labels: sorted.map(p => p.label),
      datasets: [
        {
          label: 'Tasks',
          data: sorted.map(p => p.count),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
        },
      ],
    };
  });

  readonly chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { beginAtZero: true },
    },
  };
}
