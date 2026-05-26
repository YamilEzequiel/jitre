import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'text' | 'circle' | 'rect' | 'card';

@Component({
  selector: 'jt-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      data-testid="skeleton"
      class="animate-pulse bg-white/[0.08]"
      [class]="shapeClass()"
      [style.width]="width()"
      [style.height]="height()"
      aria-hidden="true"
    ></div>
  `,
})
export class SkeletonComponent {
  readonly variant = input<SkeletonVariant>('text');
  readonly width = input<string | undefined>(undefined);
  readonly height = input<string | undefined>(undefined);
  readonly rounded = input<boolean>(false);

  readonly shapeClass = computed<string>(() => {
    switch (this.variant()) {
      case 'circle':
        return 'rounded-full';
      case 'card':
        return 'rounded-lg h-24 w-full';
      case 'rect':
        return this.rounded() ? 'rounded' : '';
      default: // text
        return 'rounded h-4 w-full';
    }
  });
}
