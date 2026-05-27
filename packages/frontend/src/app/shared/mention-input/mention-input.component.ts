import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

export interface MentionCandidate {
  userId: string;
  displayName: string;
  email?: string;
}

interface MentionMatch {
  /** index of the `@` that opened the trigger */
  start: number;
  /** end of the partial query inside the textarea */
  end: number;
  /** lower-cased query (what the user typed after `@`) */
  query: string;
}

@Component({
  selector: 'jt-mention-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <textarea
        #editor
        [rows]="rows()"
        [placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel()"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
        (blur)="onBlur()"
        class="w-full rounded-lg bg-white border border-slate-300
               px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400
               outline-none transition resize-y hover:border-slate-400
               focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25"
      ></textarea>

      @if (showSuggestions()) {
        <div
          role="listbox"
          aria-label="Mention suggestions"
          class="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-auto
                 rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/80"
        >
          @for (c of filtered(); track c.userId; let i = $index) {
            <button
              type="button"
              role="option"
              [attr.aria-selected]="i === activeIndex()"
              (mousedown)="selectByMouse($event, c)"
              (mouseenter)="activeIndex.set(i)"
              [class]="
                'w-full flex items-center gap-2 px-3 py-2 text-left text-xs ' +
                (i === activeIndex()
                  ? 'bg-indigo-50 text-indigo-900'
                  : 'text-slate-700 hover:bg-slate-50')
              "
            >
              <span
                class="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                [style.background]="avatarColor(c.userId)"
              >{{ initials(c.displayName) }}</span>
              <span class="flex-1 min-w-0">
                <span class="block truncate font-semibold">{{ c.displayName }}</span>
                @if (c.email) {
                  <span class="block truncate text-[10px] text-slate-500">{{ c.email }}</span>
                }
              </span>
            </button>
          } @empty {
            <p class="px-3 py-2 text-xs text-slate-400">No matches</p>
          }
        </div>
      }
    </div>
  `,
})
export class MentionInputComponent {
  readonly value = input<string>('');
  readonly candidates = input<MentionCandidate[]>([]);
  readonly rows = input<number>(3);
  readonly placeholder = input<string>('Write a comment… use @ to mention');
  readonly ariaLabel = input<string>('Comment');

  readonly valueChange = output<string>();
  readonly submit = output<void>();

  private readonly editor = viewChild.required<ElementRef<HTMLTextAreaElement>>('editor');

  private readonly match = signal<MentionMatch | null>(null);
  readonly activeIndex = signal(0);

  /**
   * Display-name -> userId mapping for mentions inserted via the picker.
   * The textarea shows the friendly `@Name` form; we expand it back to the
   * markdown `@[Name](id)` form when emitting `valueChange` so the storage
   * format stays canonical and the renderer keeps rendering nice badges.
   */
  private readonly mentionRegistry = new Map<string, string>();

  /**
   * Whatever encoded value we last emitted upward. If the parent's `value()`
   * input matches this we know it's a round-trip (parent stored what we
   * sent) and we must NOT overwrite the textarea — that's what caused the
   * "@[Name](uuid)" leak while typing.
   */
  private lastEmitted = '';

  constructor() {
    // Sync only on external resets (e.g. parent clears the draft after
    // posting). Detection: external `value()` differs from `lastEmitted`.
    effect(() => {
      const incoming = this.value();
      if (incoming === this.lastEmitted) return;
      const ta = this.editor()?.nativeElement;
      if (!ta) return;
      // Decode the friendly form before showing it (in case the parent
      // hands us back a stored markdown value, e.g. when editing).
      const friendly = this.decode(incoming);
      if (ta.value !== friendly) ta.value = friendly;
      this.lastEmitted = incoming;
    });

    effect(() => {
      // Reset suggestion highlight when the list shrinks below current index.
      const len = this.filtered().length;
      if (this.activeIndex() >= len) this.activeIndex.set(0);
    });
  }

  readonly filtered = computed<MentionCandidate[]>(() => {
    const m = this.match();
    if (!m) return [];
    const q = m.query;
    const list = this.candidates();
    const ranked = list
      .filter(c => c.displayName.toLowerCase().includes(q) || (c.email?.toLowerCase().includes(q) ?? false))
      .slice(0, 8);
    return ranked;
  });

  readonly showSuggestions = computed(() => this.match() !== null && this.filtered().length >= 0);

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  avatarColor(userId: string): string {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360}, 65%, 45%)`;
  }

  onInput(event: Event): void {
    const ta = event.target as HTMLTextAreaElement;
    const text = ta.value;
    const encoded = this.encode(text);
    this.lastEmitted = encoded;
    this.valueChange.emit(encoded);
    this.updateMatch(text, ta.selectionStart ?? text.length);
  }

  onBlur(): void {
    // Defer so a mousedown on a suggestion can fire before close.
    setTimeout(() => this.match.set(null), 120);
  }

  onKeydown(event: KeyboardEvent): void {
    const m = this.match();
    if (m && this.filtered().length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.activeIndex.update(i => Math.min(this.filtered().length - 1, i + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.activeIndex.update(i => Math.max(0, i - 1));
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const choice = this.filtered()[this.activeIndex()];
        if (choice) this.applyMention(choice);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.match.set(null);
        return;
      }
    }
    // Ctrl/Cmd+Enter submits the form.
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.submit.emit();
    }
  }

  selectByMouse(event: MouseEvent, c: MentionCandidate): void {
    // mousedown prevents textarea blur from firing first
    event.preventDefault();
    this.applyMention(c);
  }

  private updateMatch(text: string, caret: number): void {
    // Walk backwards from caret to find an `@` that started a token (preceded by whitespace or start of string).
    let i = caret - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === '@') {
        const before = i === 0 ? '' : text[i - 1];
        if (before === '' || /\s/.test(before)) {
          const query = text.slice(i + 1, caret).toLowerCase();
          if (/^[a-z0-9._-]*$/i.test(query)) {
            this.match.set({ start: i, end: caret, query });
            return;
          }
        }
        break;
      }
      if (/\s/.test(ch)) break;
      i--;
    }
    this.match.set(null);
  }

  private applyMention(c: MentionCandidate): void {
    const m = this.match();
    if (!m) return;
    const ta = this.editor().nativeElement;
    const text = ta.value;
    // Insert the human-friendly form in the textarea so the user sees
    // "@Yamil " instead of "@[Yamil](uuid-…)".
    const friendly = `@${c.displayName} `;
    const next = text.slice(0, m.start) + friendly + text.slice(m.end);
    ta.value = next;
    const caret = m.start + friendly.length;
    ta.setSelectionRange(caret, caret);
    ta.focus();
    this.match.set(null);
    // Record the name -> id mapping so we can re-expand the markdown form
    // on every valueChange emission.
    this.mentionRegistry.set(c.displayName.toLowerCase(), c.userId);
    const encoded = this.encode(next);
    this.lastEmitted = encoded;
    this.valueChange.emit(encoded);
  }

  /**
   * Inverse of `encode`: collapse `@[Name](id)` markdown back to `@Name`
   * for textarea display. Used when the parent feeds us a stored value
   * (initial render or after an external reset).
   */
  private decode(markdown: string): string {
    return markdown.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, (_match, name: string, id: string) => {
      this.mentionRegistry.set(name.toLowerCase(), id);
      return `@${name}`;
    });
  }

  /**
   * Convert the friendly textarea content into the canonical markdown
   * mention format consumed by the backend / renderer. Only mentions that
   * the picker inserted in this session are expanded — typing `@foo` by
   * hand stays as `@foo` (the parser server-side handles that loosely).
   */
  private encode(friendlyText: string): string {
    if (this.mentionRegistry.size === 0) return friendlyText;
    return friendlyText.replace(/@([A-Za-zÀ-ÿ0-9._-]+(?:\s+[A-Za-zÀ-ÿ0-9._-]+)?)/g, (match, name: string) => {
      const id = this.mentionRegistry.get(name.toLowerCase());
      return id ? `@[${name}](${id})` : match;
    });
  }
}
