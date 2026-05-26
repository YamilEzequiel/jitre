import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DocumentStore } from '../../stores/document.store';
import { Document } from '../../stores/document-api.service';
import { ToastService } from '../../core/toast/toast.service';
import { RichEditorComponent, RichEditorChangeEvent } from '../../shared/rich-editor/rich-editor.component';
import { DocEmojiPickerComponent } from './doc-emoji-picker.component';

const AUTOSAVE_DEBOUNCE_MS = 1500;

/**
 * Main pane of the docs feature: header (icon + editable title), meta row,
 * the rich editor, and a breadcrumb of ancestors.
 *
 * Autosave behavior:
 *   - title: debounced 1500ms after the last keystroke; also saved on blur.
 *   - content: debounced 1500ms after the last Quill text-change. We stash
 *     the latest Delta in `pendingContent` and only PATCH once.
 *
 * The "Saved" indicator briefly flashes after a successful save and then
 * fades back to "All changes saved" idle state. We deliberately don't
 * surface a toast for every save — too noisy.
 */
@Component({
  selector: 'jt-doc-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RichEditorComponent, DocEmojiPickerComponent],
  template: `
    @if (doc(); as d) {
      <div class="flex flex-col h-full bg-white">
        <!-- Top action bar (Confluence-style: thin, all white, subtle border) -->
        <div
          class="sticky top-0 z-10 flex items-center justify-between gap-3
                 border-b border-slate-200 bg-white
                 px-6 sm:px-10 lg:px-14 py-2.5"
        >
          <!-- Breadcrumb -->
          <nav class="min-w-0 flex-1 text-[12px] text-slate-500" aria-label="Breadcrumb">
            <ol class="flex flex-wrap items-center gap-1.5 min-w-0">
              <li class="text-slate-400 font-medium">Docs</li>
              @for (crumb of breadcrumbs(); track crumb.id) {
                <li class="flex items-center gap-1.5 min-w-0">
                  <span class="text-slate-300" aria-hidden="true">/</span>
                  <span
                    class="truncate max-w-[200px]"
                    [class.font-semibold]="crumb.id === d.id"
                    [class.text-slate-900]="crumb.id === d.id"
                  >{{ crumb.title || 'Untitled' }}</span>
                </li>
              }
            </ol>
          </nav>

          <!-- Save state + actions -->
          <div class="flex items-center gap-2 shrink-0">
            <span
              class="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500"
              [attr.aria-live]="'polite'"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                [class]="
                  saveState() === 'saving'
                    ? 'bg-amber-500 animate-pulse'
                    : saveState() === 'error'
                      ? 'bg-rose-500'
                      : 'bg-emerald-500'
                "
                aria-hidden="true"
              ></span>
              {{ saveLabel() }}
            </span>
            <div class="relative">
              <button
                type="button"
                (click)="toggleMenu($event)"
                [attr.aria-expanded]="menuOpen()"
                aria-haspopup="menu"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600
                       hover:bg-slate-100 hover:text-slate-900
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                aria-label="Document actions"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="12" cy="19" r="1.6" />
                </svg>
              </button>
              @if (menuOpen()) {
                <button
                  type="button"
                  class="fixed inset-0 z-30 cursor-default bg-transparent"
                  aria-label="Close menu"
                  (click)="closeMenu()"
                ></button>
                <div
                  role="menu"
                  class="absolute right-0 top-10 z-40 w-48 rounded-lg border border-slate-200
                         bg-white shadow-lg shadow-slate-300/30 py-1"
                >
                  <button
                    type="button"
                    role="menuitem"
                    (click)="copyLink(d)"
                    class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <i class="pi pi-link text-[11px]" aria-hidden="true"></i>
                    Copy link
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    (click)="onDelete()"
                    class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <i class="pi pi-trash text-[11px]" aria-hidden="true"></i>
                    Delete
                  </button>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Scrollable content canvas — pure white, generous spacing -->
        <article class="flex-1 min-h-0 overflow-auto bg-white">
          <div class="w-full px-6 sm:px-10 lg:px-14 pt-10 pb-16">
            <!-- Title block: icon inline, no floating card, no gradient -->
            <header class="mb-2 flex items-start gap-3">
              <jt-doc-emoji-picker
                [value]="d.icon"
                (changed)="onIconChange($event)"
              />
              <input
                type="text"
                class="flex-1 min-w-0 bg-transparent border-0 outline-none
                       text-3xl sm:text-4xl font-bold tracking-tight text-slate-900
                       placeholder:text-slate-300
                       focus:placeholder:text-slate-400 py-1"
                [attr.aria-label]="'Document title'"
                [value]="titleDraft()"
                placeholder="Untitled"
                (input)="onTitleInput($event)"
                (blur)="flushTitle()"
              />
            </header>

            <!-- Meta sub-line -->
            <p class="mb-8 ml-1 text-[12px] text-slate-500">
              {{ authorLabel(d.lastEditedByUserId) }} · edited {{ relativeTime(d.lastEditedAt ?? d.updatedAt) }}
            </p>

            <!-- Editor — flat, integrated -->
            <div class="prose-editor">
              <jt-rich-editor
                [value]="editorValue()"
                minHeight="60vh"
                placeholder="Type '/' for commands, or just start writing…"
                uploadContext="workspace"
                (changed)="onEditorChanged($event)"
              />
            </div>
          </div>
        </article>
      </div>
    } @else if (loading()) {
      <div class="flex h-full items-center justify-center text-sm text-slate-400">
        <span class="pi pi-spin pi-spinner mr-2" aria-hidden="true"></span>
        Loading document...
      </div>
    } @else {
      <div class="flex h-full flex-col items-center justify-center gap-3 text-center px-6">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <i class="pi pi-file text-xl" aria-hidden="true"></i>
        </div>
        <p class="text-sm font-semibold text-slate-700">Document not found</p>
        <p class="text-xs text-slate-400 max-w-xs">It may have been deleted or you don't have access.</p>
      </div>
    }
  `,
})
export class DocViewComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(DocumentStore);
  private readonly toast = inject(ToastService);

  private readonly docId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  protected readonly menuOpen = signal(false);

  protected readonly titleDraft = signal('');
  /** HTML snapshot of the current editor content (for the [value] input). */
  protected readonly editorValue = signal<string | null>(null);
  /** The most recent change payload waiting to be persisted. */
  private pendingContent: RichEditorChangeEvent | null = null;
  private titleTimer: ReturnType<typeof setTimeout> | null = null;
  private contentTimer: ReturnType<typeof setTimeout> | null = null;
  private routeSub: { unsubscribe(): void } | null = null;

  protected readonly doc = computed<Document | null>(() => {
    const id = this.docId();
    if (!id) return null;
    return this.store.byId()[id] ?? null;
  });

  protected readonly breadcrumbs = computed<Document[]>(() => {
    const current = this.doc();
    if (!current) return [];
    const map = this.store.byId();
    const chain: Document[] = [];
    let cursor: Document | undefined = current;
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id);
      chain.unshift(cursor);
      cursor = cursor.parentId ? map[cursor.parentId] : undefined;
    }
    return chain;
  });

  protected readonly saveLabel = computed(() => {
    switch (this.saveState()) {
      case 'saving': return 'Saving...';
      case 'saved': return 'Saved';
      case 'error': return 'Save failed';
      default: return 'All changes saved';
    }
  });

  constructor() {
    // When the doc reference changes (e.g. switched docs from sidebar), sync
    // the local drafts so the title input / editor reflect the new content.
    effect(() => {
      const d = this.doc();
      if (!d) return;
      this.titleDraft.set(d.title);
      this.editorValue.set(this.deltaToHtml(d.content));
    });
  }

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(async params => {
      const id = params.get('id');
      if (this.docId() && id !== this.docId()) {
        // Angular reuses this component between /docs/:id routes. Persist the
        // current page before changing docId so a delayed autosave never
        // writes page A's draft into page B.
        await this.flushTitle();
        await this.flushContent();
      }
      this.docId.set(id);
      if (id && !this.store.byId()[id]) {
        this.loading.set(true);
        try {
          await this.store.loadById(id);
        } catch {
          this.toast.error('Failed to load document');
        } finally {
          this.loading.set(false);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    if (this.titleTimer) clearTimeout(this.titleTimer);
    if (this.contentTimer) clearTimeout(this.contentTimer);
    // Best-effort flush on teardown so navigating away doesn't lose edits.
    this.flushTitle();
    this.flushContent();
  }

  protected onTitleInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.titleDraft.set(v);
    if (this.titleTimer) clearTimeout(this.titleTimer);
    this.titleTimer = setTimeout(() => this.flushTitle(), AUTOSAVE_DEBOUNCE_MS);
  }

  protected async flushTitle(): Promise<void> {
    if (this.titleTimer) {
      clearTimeout(this.titleTimer);
      this.titleTimer = null;
    }
    const d = this.doc();
    if (!d) return;
    const draft = this.titleDraft().trim() || 'Untitled';
    if (draft !== this.titleDraft()) this.titleDraft.set(draft);
    if (draft === d.title) return;
    await this.persist({ title: draft });
  }

  protected onIconChange(icon: string | null): void {
    const d = this.doc();
    if (!d || icon === d.icon) return;
    this.persist({ icon });
  }

  protected onEditorChanged(event: RichEditorChangeEvent): void {
    this.pendingContent = event;
    this.editorValue.set(event.htmlValue);
    if (this.contentTimer) clearTimeout(this.contentTimer);
    this.contentTimer = setTimeout(() => this.flushContent(), AUTOSAVE_DEBOUNCE_MS);
  }

  protected async flushContent(): Promise<void> {
    if (this.contentTimer) {
      clearTimeout(this.contentTimer);
      this.contentTimer = null;
    }
    if (!this.pendingContent) return;
    const event = this.pendingContent;
    this.pendingContent = null;
    // Persist both Delta and rendered HTML: Delta remains the searchable/editable
    // source while HTML lets the editor hydrate the document after navigation.
    const content =
      typeof event.delta === 'object' && event.delta !== null
        ? { ...(event.delta as Record<string, unknown>), html: event.htmlValue ?? '' }
        : { html: event.htmlValue ?? '' };
    await this.persist({ content });
  }

  protected async onDelete(): Promise<void> {
    this.menuOpen.set(false);
    const d = this.doc();
    if (!d) return;
    if (!confirm(`Delete "${d.title || 'Untitled'}"? This cannot be undone.`)) return;
    try {
      await this.store.delete(d.id);
      this.toast.success('Document deleted');
      await this.router.navigate(['/docs']);
    } catch {
      this.toast.error('Failed to delete document');
    }
  }

  protected toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update(v => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected async copyLink(d: Document): Promise<void> {
    this.menuOpen.set(false);
    try {
      const url = `${window.location.origin}/docs/${d.id}`;
      await navigator.clipboard.writeText(url);
      this.toast.success('Link copied');
    } catch {
      this.toast.error('Could not copy link');
    }
  }

  protected authorLabel(userId: string): string {
    if (!userId) return 'Someone';
    // We don't have a workspace-wide user directory in this view, so we render
    // a short, friendlier label instead of the raw UUID prefix.
    const short = userId.replace(/-/g, '').slice(0, 6).toUpperCase();
    return `User ${short}`;
  }

  private async persist(patch: { title?: string; icon?: string | null; content?: Record<string, unknown> }): Promise<void> {
    const d = this.doc();
    if (!d) return;
    this.saveState.set('saving');
    try {
      await this.store.update(d.id, patch);
      this.saveState.set('saved');
      setTimeout(() => {
        if (this.saveState() === 'saved') this.saveState.set('idle');
      }, 1200);
    } catch {
      this.saveState.set('error');
      this.toast.error('Failed to save document');
    }
  }

  /**
   * Best-effort conversion from the stored content blob back to HTML for the
   * editor. The backend stores Quill Deltas, but we also tolerate documents
   * created elsewhere that may carry an `{ html }` fallback.
   */
  private deltaToHtml(content: Record<string, unknown>): string | null {
    if (!content) return null;
    if (typeof content['html'] === 'string') return content['html'] as string;
    const ops = (content as { ops?: unknown }).ops;
    if (Array.isArray(ops)) {
      const rawText = ops
        .map((op) => {
          if (!op || typeof op !== 'object') return '';
          const insert = (op as { insert?: unknown }).insert;
          return typeof insert === 'string' ? insert : '';
        })
        .join('');
      if (!rawText) return null;
      const escaped = rawText
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
      const lines = escaped.endsWith('\n')
        ? escaped.slice(0, -1).split('\n')
        : escaped.split('\n');
      return lines.map(line => `<p>${line || '<br>'}</p>`).join('');
    }
    return null;
  }

  protected relativeTime(iso: string | null): string {
    if (!iso) return 'just now';
    const ms = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(ms)) return 'just now';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
  }
}
