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
      <article class="flex flex-col h-full max-w-5xl mx-auto px-6 sm:px-10 py-8">
        <!-- Breadcrumb -->
        <nav class="mb-3 text-xs text-slate-400" aria-label="Breadcrumb">
          <ol class="flex flex-wrap items-center gap-1">
            <li>Workspace</li>
            @for (crumb of breadcrumbs(); track crumb.id) {
              <li class="flex items-center gap-1">
                <span aria-hidden="true">›</span>
                <span class="truncate max-w-[160px]">{{ crumb.title || 'Untitled' }}</span>
              </li>
            }
          </ol>
        </nav>

        <!-- Header: icon + title -->
        <header class="flex items-start gap-4 mb-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
          <jt-doc-emoji-picker
            [value]="d.icon"
            (changed)="onIconChange($event)"
          />
          <input
            type="text"
            class="flex-1 min-w-0 bg-transparent border-0 outline-none
                   text-3xl sm:text-4xl font-black tracking-tight text-slate-950
                   placeholder:text-slate-300"
            [attr.aria-label]="'Document title'"
            [value]="titleDraft()"
            placeholder="Untitled"
            (input)="onTitleInput($event)"
            (blur)="flushTitle()"
          />
        </header>

        <!-- Meta -->
        <div class="flex items-center justify-between gap-3 mb-6 text-[11px] text-slate-400">
          <span>
            Edited by {{ d.lastEditedByUserId.slice(0, 8) }} ·
            {{ relativeTime(d.lastEditedAt ?? d.updatedAt) }}
          </span>
          <div class="flex items-center gap-3">
            <span
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
                     border border-slate-200 bg-white text-[10px] uppercase tracking-wider"
              [attr.aria-live]="'polite'"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                [class]="
                  saveState() === 'saving'
                    ? 'bg-amber-400 animate-pulse'
                    : saveState() === 'error'
                      ? 'bg-rose-500'
                      : 'bg-emerald-400'
                "
                aria-hidden="true"
              ></span>
              {{ saveLabel() }}
            </span>
            <button
              type="button"
              class="text-rose-600 hover:text-rose-700 text-[11px] underline"
              (click)="onDelete()"
              [attr.aria-label]="'Delete ' + d.title"
            >
              Delete
            </button>
          </div>
        </div>

        <!-- Editor -->
        <div class="flex-1 min-h-0">
          <jt-rich-editor
            [value]="editorValue()"
            minHeight="600px"
            placeholder="Start writing..."
            (changed)="onEditorChanged($event)"
          />
        </div>
      </article>
    } @else if (loading()) {
      <div class="flex h-full items-center justify-center text-sm text-slate-400">
        Loading document...
      </div>
    } @else {
      <div class="flex h-full items-center justify-center text-sm text-slate-400">
        Document not found.
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
