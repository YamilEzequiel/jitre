import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  input,
  viewChild,
} from '@angular/core';
import type { ChartConfiguration, ChartType } from 'chart.js';

@Component({
  selector: 'jt-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <canvas
      #canvas
      [attr.aria-label]="ariaLabel()"
      role="img"
      class="w-full h-full"
    ></canvas>
  `,
})
export class ChartComponent implements OnDestroy {
  readonly chartType = input.required<ChartType>();
  readonly chartData = input<ChartConfiguration['data']>({ datasets: [] });
  readonly chartOptions = input<ChartConfiguration['options']>({});
  readonly ariaLabel = input<string>('Chart');

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private chartInstance: any = null;

  constructor() {
    afterNextRender(() => {
      void this.initChart();
    });
  }

  private async initChart(): Promise<void> {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    this.chartInstance = new Chart(ctx, {
      type: this.chartType(),
      data: this.chartData(),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...this.chartOptions(),
      },
    });
  }

  ngOnDestroy(): void {
    this.chartInstance?.destroy();
    this.chartInstance = null;
  }
}
