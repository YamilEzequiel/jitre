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
      <ng-container *cdkVirtualFor="let item of items(); let idx = index; trackBy: trackByFn">
        <ng-container
          *ngTemplateOutlet="rowTemplate ?? fallback; context: { $implicit: item, index: idx }"
        ></ng-container>
      </ng-container>
    </cdk-virtual-scroll-viewport>
    <ng-template #fallback let-item>
      <div>{{ item }}</div>
    </ng-template>
  `,
})
export class VirtualListComponent<T> {
  readonly items = input<T[]>([]);
  readonly itemSize = input<number>(48);
  readonly trackByKey = input<keyof T>('id' as keyof T);

  @ContentChild('row') rowTemplate?: TemplateRef<{ $implicit: T; index: number }>;

  readonly trackByFn = (_index: number, item: T): unknown =>
    (item as Record<string, unknown>)[this.trackByKey() as string];
}
