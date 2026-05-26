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

@Component({
  selector: 'jt-message-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div
      class="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3
             focus-within:border-violet-400 focus-within:bg-white focus-within:shadow-sm"
    >
      <textarea
        #textarea
        [(ngModel)]="value"
        (input)="onInput()"
        (keydown.enter)="onEnter($event)"
        (keydown.shift.enter)="$event.stopPropagation()"
        rows="1"
        [attr.aria-label]="placeholder()"
        [placeholder]="placeholder()"
        class="flex-1 max-h-48 resize-none bg-transparent text-sm text-slate-700 outline-none
               placeholder:text-slate-400"
      ></textarea>
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
  `,
})
export class MessageInputComponent implements OnDestroy {
  readonly placeholder = input<string>('Write a message…');

  readonly sent = output<string>();
  readonly typingStart = output<void>();
  readonly typingStop = output<void>();

  readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  readonly value = signal('');

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

  onEnter(event: Event): void {
    const ev = event as KeyboardEvent;
    if (ev.shiftKey) return;
    ev.preventDefault();
    this.send();
  }

  send(): void {
    const body = this.value().trim();
    if (!body) return;
    this.sent.emit(body);
    this.value.set('');
    this._stopTyping();
    queueMicrotask(() => this._autoGrow());
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
