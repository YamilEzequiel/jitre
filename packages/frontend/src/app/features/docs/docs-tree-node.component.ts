import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { Document } from '../../stores/document-api.service';

export interface DocsTreeNodeAction {
  type: 'select' | 'add-child' | 'rename' | 'delete';
  doc: Document;
}

export interface DocsDropEvent {
  draggedId: string;
  targetParentId: string | null;
  targetOrder: number;
}

/**
 * Recursive sidebar node for the Docs feature.
 *
 * Concerns split:
 *   - render the row + chevron + kebab
 *   - emit user intent up the chain (selection, add-child, rename, delete)
 *   - emit drop events with absolute parentId/order; the docs page does
 *     the API call and reconciliation
 *
 * The drag-and-drop UX uses the native HTML5 DnD API: dragstart sets the
 * doc id as text/plain payload, dragover marks the node as a drop target,
 * drop emits a DocsDropEvent. We always drop "into" the target (becomes
 * its first child) for simplicity — reordering between siblings is left
 * as a v2 refinement.
 */
@Component({
  selector: 'jt-docs-tree-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="group flex items-center gap-1 rounded-lg px-1.5 py-1
             border border-transparent hover:bg-white hover:border-slate-200
             transition-colors"
      [class]="
        isSelected()
          ? 'bg-slate-100 border-slate-200 shadow-md shadow-indigo-500/10'
          : ''
      "
      [class.ring-2]="isDropTarget()"
      [class.ring-indigo-400]="isDropTarget()"
      draggable="true"
      (dragstart)="onDragStart($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave()"
      (drop)="onDrop($event)"
    >
      <!-- chevron / spacer -->
      @if (hasChildren()) {
        <button
          type="button"
          class="flex h-5 w-5 items-center justify-center rounded
                 text-slate-500 hover:text-violet-700 hover:bg-violet-50
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          (click)="toggleExpanded($event)"
          [attr.aria-expanded]="expanded()"
          [attr.aria-label]="expanded() ? 'Collapse ' + doc().title : 'Expand ' + doc().title"
        >
          <span
            class="inline-block transition-transform text-[10px]"
            [style.transform]="expanded() ? 'rotate(90deg)' : 'rotate(0)'"
            aria-hidden="true"
          >▶</span>
        </button>
      } @else {
        <span class="inline-block h-5 w-5" aria-hidden="true"></span>
      }

      <!-- icon -->
      <span
        class="flex h-5 w-5 flex-none items-center justify-center text-sm"
        aria-hidden="true"
      >
        @if (doc().icon) {
          <span>{{ doc().icon }}</span>
        } @else {
          <i class="pi pi-file text-[12px] text-slate-500"></i>
        }
      </span>

      <!-- title button -->
      <button
        type="button"
        class="flex-1 min-w-0 text-left text-[13px] font-medium text-slate-700
               hover:text-violet-700 truncate
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded"
        (click)="emit('select')"
        [attr.aria-current]="isSelected() ? 'page' : null"
      >
        {{ doc().title || 'Untitled' }}
      </button>

      <!-- kebab actions -->
      <div class="relative opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded
                 text-slate-500 hover:text-violet-700 hover:bg-violet-50
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          (click)="toggleMenu($event)"
          [attr.aria-label]="'Actions for ' + doc().title"
          [attr.aria-expanded]="menuOpen()"
        >
          <i class="pi pi-ellipsis-h text-[12px]" aria-hidden="true"></i>
        </button>
        @if (menuOpen()) {
          <div
            class="absolute right-0 top-7 z-20 w-40 rounded-lg border border-slate-200
                   bg-white shadow-xl shadow-slate-200/80 py-1"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700
                     hover:bg-white"
              (click)="onMenuAction($event, 'add-child')"
            >
              <i class="pi pi-plus text-[11px]" aria-hidden="true"></i> Add child
            </button>
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700
                     hover:bg-white"
              (click)="onMenuAction($event, 'rename')"
            >
              <i class="pi pi-pencil text-[11px]" aria-hidden="true"></i> Rename
            </button>
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-rose-600
                     hover:bg-rose-500/10"
              (click)="onMenuAction($event, 'delete')"
            >
              <i class="pi pi-trash text-[11px]" aria-hidden="true"></i> Delete
            </button>
          </div>
        }
      </div>
    </div>

    @if (expanded() && hasChildren()) {
      <ul class="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
        @for (child of doc().children ?? []; track child.id) {
          <li>
            <jt-docs-tree-node
              [doc]="child"
              [selectedId]="selectedId()"
              (action)="action.emit($event)"
              (dropped)="dropped.emit($event)"
            />
          </li>
        }
      </ul>
    }
  `,
})
export class DocsTreeNodeComponent {
  readonly doc = input.required<Document>();
  readonly selectedId = input<string | null>(null);

  readonly action = output<DocsTreeNodeAction>();
  readonly dropped = output<DocsDropEvent>();

  protected readonly expanded = signal(true);
  protected readonly menuOpen = signal(false);
  protected readonly isDropTarget = signal(false);

  protected readonly isSelected = computed(() => this.selectedId() === this.doc().id);
  protected readonly hasChildren = computed(() => (this.doc().children?.length ?? 0) > 0);

  protected toggleExpanded(event: MouseEvent): void {
    event.stopPropagation();
    this.expanded.update(v => !v);
  }

  protected toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update(v => !v);
  }

  protected onMenuAction(event: MouseEvent, type: 'add-child' | 'rename' | 'delete'): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.action.emit({ type, doc: this.doc() });
  }

  protected emit(type: 'select'): void {
    this.action.emit({ type, doc: this.doc() });
  }

  protected onDragStart(event: DragEvent): void {
    event.stopPropagation();
    event.dataTransfer?.setData('text/plain', this.doc().id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.isDropTarget.set(true);
  }

  protected onDragLeave(): void {
    this.isDropTarget.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDropTarget.set(false);
    const draggedId = event.dataTransfer?.getData('text/plain');
    if (!draggedId || draggedId === this.doc().id) return;
    // Drop "into" the node — it becomes its first child.
    this.dropped.emit({
      draggedId,
      targetParentId: this.doc().id,
      targetOrder: 0,
    });
  }
}
