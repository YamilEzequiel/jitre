import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { DocumentStore } from '../../stores/document.store';
import { Document } from '../../stores/document-api.service';
import { ToastService } from '../../core/toast/toast.service';
import {
  DocsDropEvent,
  DocsTreeNodeAction,
  DocsTreeNodeComponent,
} from './docs-tree-node.component';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Docs feature root. Layout split:
 *
 *   ┌─────────────────────┬─────────────────────────────────────┐
 *   │ Sidebar (~280px)    │ Main pane (router-outlet)           │
 *   │ - new page button   │ <jt-doc-view /> when /docs/:id      │
 *   │ - search            │ empty state otherwise               │
 *   │ - tree nodes        │                                     │
 *   └─────────────────────┴─────────────────────────────────────┘
 *
 * The component owns all sidebar concerns (load tree, search, create/move/
 * delete operations) and renders the doc-view via the router outlet so the
 * URL is deep-linkable.
 */
@Component({
  selector: 'jt-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, DocsTreeNodeComponent],
  template: `
    <div class="flex h-full min-h-0 -m-4 sm:-m-6 lg:-m-8">
      @if (mobileNavOpen()) {
        <button
          type="button"
          class="fixed inset-0 z-30 bg-slate-950/25 lg:hidden"
          aria-label="Close pages navigation"
          (click)="closeMobileNav()"
        ></button>
      }

      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-40 flex-col w-72 shrink-0 border-r border-slate-200
               bg-white shadow-xl lg:static lg:z-auto lg:flex lg:shadow-none"
        [class.flex]="mobileNavOpen()"
        [class.hidden]="!mobileNavOpen()"
        aria-label="Documents navigation"
      >
        <div class="flex items-center justify-between px-4 pt-5 pb-3">
          <div>
            <span
              class="text-[10px] font-bold uppercase tracking-[0.18em]
                     text-violet-700"
            >
              Workspace
            </span>
            <h2 class="text-lg font-black text-slate-950">Docs</h2>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold
                     text-white bg-gradient-to-r from-indigo-600 to-violet-600
                     shadow-md shadow-indigo-500/25
                     hover:shadow-lg hover:shadow-indigo-500/40
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                     transition-shadow"
              (click)="createDoc(null)"
              aria-label="New page"
            >
              <i class="pi pi-plus text-[10px]" aria-hidden="true"></i> New
            </button>
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500
                     hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              aria-label="Close pages navigation"
              (click)="closeMobileNav()"
            >
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div class="px-4 pb-3">
          <label class="relative block">
            <i
              class="pi pi-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-slate-400"
              aria-hidden="true"
            ></i>
            <input
              type="search"
              placeholder="Search docs..."
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              class="w-full rounded-lg border border-slate-200 bg-white
                     pl-8 pr-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              aria-label="Search documents"
            />
          </label>
        </div>

        <div class="flex-1 overflow-auto px-2 pb-4">
          @if (searchQuery().trim().length > 0) {
            <ul class="space-y-0.5">
              @for (hit of searchResults(); track hit.id) {
                <li>
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5
                           text-left text-[13px] text-slate-700
                           hover:bg-white
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                    (click)="selectDoc(hit.id)"
                  >
                    @if (hit.icon) {
                      <span aria-hidden="true">{{ hit.icon }}</span>
                    } @else {
                      <i class="pi pi-file text-[11px] text-slate-500" aria-hidden="true"></i>
                    }
                    <span class="truncate">{{ hit.title || 'Untitled' }}</span>
                  </button>
                </li>
              } @empty {
                <li class="px-3 py-4 text-center text-xs text-slate-400">
                  No matches.
                </li>
              }
            </ul>
          } @else {
            @if (store.loading()) {
              <p class="px-3 py-4 text-center text-xs text-slate-400">Loading...</p>
            } @else {
              <ul class="space-y-0.5">
                @for (root of store.tree(); track root.id) {
                  <li>
                    <jt-docs-tree-node
                      [doc]="root"
                      [selectedId]="selectedId()"
                      (action)="onTreeAction($event)"
                      (dropped)="onDropped($event)"
                    />
                  </li>
                } @empty {
                  <li class="px-3 py-6 text-center text-xs text-slate-400">
                    No pages yet.
                  </li>
                }
              </ul>
            }
          }
        </div>
      </aside>

      <!-- Main -->
      <section class="flex-1 min-w-0 overflow-auto bg-white">
        <div class="sticky top-0 z-20 flex items-center border-b border-slate-200 bg-white/95 px-4 py-3 lg:hidden">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700
                   hover:bg-slate-100"
            (click)="openMobileNav()"
            aria-label="Open pages navigation"
          >
            <i class="pi pi-bars" aria-hidden="true"></i> Pages
          </button>
        </div>
        @if (selectedId()) {
          <router-outlet></router-outlet>
        } @else {
          <div class="flex h-full flex-col items-center justify-center gap-4 text-center px-6">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-2xl
                     bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30"
            >
              <i class="pi pi-book text-2xl text-white" aria-hidden="true"></i>
            </div>
            <div class="space-y-1">
              <h2 class="text-xl font-black text-slate-950">No document selected</h2>
              <p class="text-sm text-slate-500 max-w-sm">
                Pick a page from the sidebar or create a new one to get started.
              </p>
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white
                     bg-gradient-to-r from-indigo-600 to-violet-600
                     shadow-md shadow-indigo-500/25
                     hover:shadow-lg hover:shadow-indigo-500/40
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                     focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                     transition-shadow"
              (click)="createDoc(null)"
            >
              <i class="pi pi-plus text-[12px]" aria-hidden="true"></i>
              Create your first doc
            </button>
          </div>
        }
      </section>
    </div>
  `,
})
export class DocsComponent implements OnInit, OnDestroy {
  protected readonly store = inject(DocumentStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly searchQuery = signal('');
  protected readonly searchResults = signal<Document[]>([]);
  protected readonly mobileNavOpen = signal(false);
  private readonly _selectedId = signal<string | null>(null);
  protected readonly selectedId = this._selectedId.asReadonly();

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private childSub: { unsubscribe(): void } | null = null;

  protected readonly hasDocs = computed(() => this.store.tree().length > 0);

  ngOnInit(): void {
    // Initial load. Errors surface as a toast — the empty state takes over.
    this.store.loadTree().catch(() => {
      this.toast.error('Failed to load documents');
    });

    // Track which doc is open via the active child route's :id param.
    this.childSub = this.route.firstChild?.paramMap.subscribe(params => {
      this._selectedId.set(params.get('id'));
    }) ?? null;

    // Fallback when the firstChild is not yet resolved at mount.
    if (!this.childSub) {
      this.route.children.forEach(child => {
        child.paramMap.subscribe(params => this._selectedId.set(params.get('id')));
      });
    }

    // Re-evaluate selection on every navigation that lands inside /docs.
    this.router.events.subscribe(() => {
      const id = this.findChildId(this.route);
      this._selectedId.set(id);
    });
  }

  ngOnDestroy(): void {
    this.childSub?.unsubscribe();
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  protected onSearchInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.searchQuery.set(v);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (!v.trim()) {
      this.searchResults.set([]);
      return;
    }
    this.searchTimer = setTimeout(async () => {
      try {
        const hits = await this.store.search(v.trim());
        this.searchResults.set(hits);
      } catch {
        this.searchResults.set([]);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  protected selectDoc(id: string): void {
    this.closeMobileNav();
    this.router.navigate(['/docs', id]);
  }

  protected async createDoc(parentId: string | null): Promise<void> {
    try {
      const created = await this.store.create({
        title: 'Untitled',
        parentId,
      });
      this.closeMobileNav();
      this.toast.success('Page created');
      this.router.navigate(['/docs', created.id]);
    } catch {
      this.toast.error('Failed to create page');
    }
  }

  protected onTreeAction(event: DocsTreeNodeAction): void {
    switch (event.type) {
      case 'select':
        this.selectDoc(event.doc.id);
        return;
      case 'add-child':
        this.createDoc(event.doc.id);
        return;
      case 'rename':
        this.selectDoc(event.doc.id);
        return;
      case 'delete':
        this.deleteDoc(event.doc);
        return;
    }
  }

  protected openMobileNav(): void {
    this.mobileNavOpen.set(true);
  }

  protected closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  protected async deleteDoc(doc: Document): Promise<void> {
    if (!confirm(`Delete "${doc.title || 'Untitled'}"? Children will also be removed.`)) return;
    try {
      await this.store.delete(doc.id);
      this.toast.success('Page deleted');
      if (this.selectedId() === doc.id) {
        this.router.navigate(['/docs']);
      }
    } catch {
      this.toast.error('Failed to delete page');
    }
  }

  protected async onDropped(event: DocsDropEvent): Promise<void> {
    // Don't allow a node to be dropped into itself or one of its descendants
    // — backend will reject it but we want optimistic UX too.
    if (event.draggedId === event.targetParentId) return;
    if (event.targetParentId && this.isDescendant(event.draggedId, event.targetParentId)) {
      this.toast.error('Cannot move a page into its own subtree');
      return;
    }
    try {
      await this.store.move(event.draggedId, {
        parentId: event.targetParentId,
        order: event.targetOrder,
      });
      // Move can swap parents, so refetch the tree for the source-of-truth
      // ordering. Cheap enough — one request.
      await this.store.loadTree();
    } catch {
      this.toast.error('Failed to move page');
    }
  }

  private isDescendant(ancestorId: string, candidateId: string): boolean {
    const root = this.findInTree(this.store.tree(), ancestorId);
    if (!root) return false;
    const stack: Document[] = [...(root.children ?? [])];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.id === candidateId) return true;
      if (n.children) stack.push(...n.children);
    }
    return false;
  }

  private findInTree(nodes: Document[], id: string): Document | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      const hit = n.children ? this.findInTree(n.children, id) : null;
      if (hit) return hit;
    }
    return null;
  }

  private findChildId(route: ActivatedRoute): string | null {
    let cursor: ActivatedRoute | null = route;
    while (cursor) {
      const id = cursor.snapshot.paramMap.get('id');
      if (id) return id;
      cursor = cursor.firstChild;
    }
    return null;
  }
}
