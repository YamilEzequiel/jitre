import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  TemplateRef,
  input,
} from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'jt-virtual-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollingModule, NgTemplateOutlet],
  template: `
    <cdk-virtual-scroll-viewport
      [itemSize]="itemSize()"
      class="h-full w-full overflow-auto"
    >
      <ng-container *cdkVirtualFor="let item of items(); trackBy: trackByFn">
        <ng-container
          *ngTemplateOutlet="rowTemplate ?? fallback; context: { $implicit: item }"
        ></ng-container>
      </ng-container>
    </cdk-virtual-scroll-viewport>
    <ng-template #fallback let-item>
      <div>{{ item }}</div>
    </ng-template>
  `,
})
export class VirtualListComponent<T extends Record<string, unknown>> {
  readonly items = input<T[]>([]);
  readonly itemSize = input<number>(48);
  readonly trackByKey = input<keyof T>('id' as keyof T);

  @ContentChild('row') rowTemplate?: TemplateRef<{ $implicit: T }>;

  readonly trackByFn = (_index: number, item: T): unknown => item[this.trackByKey()];
}
