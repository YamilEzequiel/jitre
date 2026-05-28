import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  TemplateRef,
  input,
} from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ScrollingModule as ExperimentalScrollingModule } from '@angular/cdk-experimental/scrolling';
import { NgTemplateOutlet } from '@angular/common';

/**
 * Variable-height virtual list. Use this when the row template renders
 * markdown, attachments, or anything whose height the parent can't predict
 * — chat messages and kanban cards are the canonical cases.
 *
 * For uniform rows (table-shaped layouts) prefer [VirtualListComponent]
 * with a fixed itemSize — it's cheaper because the viewport doesn't have
 * to measure every row.
 *
 * Backed by @angular/cdk-experimental's auto-size strategy. The
 * minBufferPx / maxBufferPx pair controls how many extra px of rows
 * stay mounted off-screen; bumping them reduces flicker on fast scrolls
 * at the cost of memory.
 */
@Component({
  selector: 'jt-autosize-virtual-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollingModule, ExperimentalScrollingModule, NgTemplateOutlet],
  template: `
    <cdk-virtual-scroll-viewport
      autosize
      [minBufferPx]="minBufferPx()"
      [maxBufferPx]="maxBufferPx()"
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
export class AutosizeVirtualListComponent<T extends Record<string, unknown>> {
  readonly items = input<T[]>([]);
  readonly trackByKey = input<keyof T>('id' as keyof T);
  readonly minBufferPx = input<number>(200);
  readonly maxBufferPx = input<number>(400);

  @ContentChild('row') rowTemplate?: TemplateRef<{ $implicit: T }>;

  readonly trackByFn = (_index: number, item: T): unknown => item[this.trackByKey()];
}
