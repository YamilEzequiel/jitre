import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmojiPickerComponent } from './emoji-picker.component';

type WrapToken =
  | { kind: 'wrap'; prefix: string; suffix: string }
  | { kind: 'link' };

@Component({
  selector: 'jt-message-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, EmojiPickerComponent],
  template: `
    <div class="relative">
      <div
        class="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3
               focus-within:border-violet-400 focus-within:bg-white focus-within:shadow-sm"
      >
        <textarea
          #textarea
          [(ngModel)]="value"
          (input)="onInput()"
          (keydown)="onKeydown($event)"
          rows="1"
          [attr.aria-label]="placeholder()"
          [placeholder]="placeholder()"
          class="flex-1 max-h-48 resize-none bg-transparent text-sm text-slate-700 outline-none
                 placeholder:text-slate-400"
        ></textarea>

        <button
          type="button"
          (click)="toggleEmojiPicker()"
          [attr.aria-expanded]="showEmojiPicker()"
          aria-label="Insert emoji"
          class="flex h-9 w-9 items-center justify-center rounded-full text-base
                 transition hover:bg-violet-100"
          [class.bg-violet-100]="showEmojiPicker()"
        >
          😊
        </button>

        <button
          type="button"
          [disabled]="!canSend()"
          (click)="send()"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full text-white
                 bg-gradient-to-br from-indigo-600 to-violet-600
                 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          <i class="pi pi-send text-xs" aria-hidden="true"></i>
        </button>
      </div>

      <div
        class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-slate-400"
      >
        <span class="inline-flex items-center gap-1">
          <kbd class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] text-slate-600">{{ modKey }}+B</kbd>
          <span><strong class="text-slate-600">bold</strong></span>
        </span>
        <span class="inline-flex items-center gap-1">
          <kbd class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] text-slate-600">{{ modKey }}+I</kbd>
          <span><em class="text-slate-600">italic</em></span>
        </span>
        <span class="inline-flex items-center gap-1">
          <kbd class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] text-slate-600">{{ modKey }}+E</kbd>
          <span><code class="rounded bg-slate-100 px-1 text-slate-600">code</code></span>
        </span>
        <span class="inline-flex items-center gap-1">
          <kbd class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] text-slate-600">{{ modKey }}+K</kbd>
          <span>link</span>
        </span>
        <span class="ml-auto text-slate-400">
          <kbd class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] text-slate-600">Shift+Enter</kbd>
          newline
        </span>
      </div>

      @if (showEmojiPicker()) {
        <div class="absolute bottom-full right-0 z-20 mb-2">
          <jt-emoji-picker
            (picked)="onEmojiPicked($event)"
            (dismissed)="showEmojiPicker.set(false)"
          />
        </div>
      }
    </div>
  `,
})
export class MessageInputComponent implements OnDestroy {
  readonly placeholder = input<string>('Write a message…');

  readonly sent = output<string>();
  readonly typingStart = output<void>();
  readonly typingStop = output<void>();

  readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  readonly value = signal('');
  readonly showEmojiPicker = signal(false);

  readonly modKey = this._detectModKey();

  private _typingActive = false;
  private _typingTimer: ReturnType<typeof setTimeout> | null = null;

  canSend(): boolean {
    return this.value().trim().length > 0;
  }

  onInput(): void {
    this._autoGrow();
    if (this.value().trim().length === 0) {
      this._stopTyping();
      return;
    }
    if (!this._typingActive) {
      this._typingActive = true;
      this.typingStart.emit();
    }
    if (this._typingTimer) clearTimeout(this._typingTimer);
    this._typingTimer = setTimeout(() => this._stopTyping(), 1000);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
      return;
    }

    const mod = event.metaKey || event.ctrlKey;
    if (!mod) return;

    const key = event.key.toLowerCase();
    switch (key) {
      case 'b':
        event.preventDefault();
        this._applyToken({ kind: 'wrap', prefix: '**', suffix: '**' });
        return;
      case 'i':
        event.preventDefault();
        this._applyToken({ kind: 'wrap', prefix: '_', suffix: '_' });
        return;
      case 'e':
        event.preventDefault();
        this._applyToken({ kind: 'wrap', prefix: '`', suffix: '`' });
        return;
      case 'k':
        event.preventDefault();
        this._applyToken({ kind: 'link' });
        return;
    }
  }

  send(): void {
    const body = this.value().trim();
    if (!body) return;
    this.sent.emit(body);
    this.value.set('');
    this._stopTyping();
    this.showEmojiPicker.set(false);
    queueMicrotask(() => this._autoGrow());
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker.update(v => !v);
  }

  onEmojiPicked(emoji: string): void {
    this._insertAtCursor(emoji);
    this.showEmojiPicker.set(false);
    this.onInput();
  }

  private _applyToken(token: WrapToken): void {
    const el = this.textarea()?.nativeElement;
    if (!el) return;
    const start = el.selectionStart ?? this.value().length;
    const end = el.selectionEnd ?? this.value().length;
    const current = this.value();
    const selected = current.slice(start, end);

    let inserted: string;
    let cursorStart: number;
    let cursorEnd: number;

    if (token.kind === 'wrap') {
      inserted = `${token.prefix}${selected}${token.suffix}`;
      cursorStart = start + token.prefix.length;
      cursorEnd = cursorStart + selected.length;
    } else {
      const text = selected || 'text';
      inserted = `[${text}](url)`;
      if (selected) {
        const urlStart = start + selected.length + 3;
        cursorStart = urlStart;
        cursorEnd = urlStart + 3;
      } else {
        cursorStart = start + 1;
        cursorEnd = cursorStart + text.length;
      }
    }

    const next = current.slice(0, start) + inserted + current.slice(end);
    this.value.set(next);
    this.onInput();

    queueMicrotask(() => {
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  private _insertAtCursor(text: string): void {
    const el = this.textarea()?.nativeElement;
    const current = this.value();
    if (!el) {
      this.value.set(current + text);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + text + current.slice(end);
    this.value.set(next);

    queueMicrotask(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }

  private _detectModKey(): string {
    if (typeof navigator === 'undefined') return 'Ctrl';
    const platform = navigator.platform || navigator.userAgent;
    return /Mac|iPhone|iPad/i.test(platform) ? '⌘' : 'Ctrl';
  }

  private _stopTyping(): void {
    if (this._typingTimer) {
      clearTimeout(this._typingTimer);
      this._typingTimer = null;
    }
    if (this._typingActive) {
      this._typingActive = false;
      this.typingStop.emit();
    }
  }

  private _autoGrow(): void {
    const el = this.textarea()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 192) + 'px';
  }

  ngOnDestroy(): void {
    this._stopTyping();
  }
}
