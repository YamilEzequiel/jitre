import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * Lightweight emoji picker.
 *
 * Simplification: rather than ship a full Unicode emoji index, we expose a
 * curated grid of ~40 common page icons (matches Notion's defaults for
 * docs/projects) plus a "type your own" text input. Anything the user
 * pastes in the input is treated as the icon string. Backend accepts any
 * short string for `icon`, so this is enough for v1.
 */
@Component({
  selector: 'jt-doc-emoji-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-block">
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200
               bg-white backdrop-blur-sm text-2xl
               hover:bg-slate-100 hover:border-slate-300
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
               focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
               transition-colors"
        (click)="toggle($event)"
        [attr.aria-label]="value() ? 'Change icon' : 'Add icon'"
        [attr.aria-expanded]="open()"
      >
        @if (value()) {
          <span aria-hidden="true">{{ value() }}</span>
        } @else {
          <i class="pi pi-image text-base text-slate-500" aria-hidden="true"></i>
        }
      </button>

      @if (open()) {
        <div
          class="absolute left-0 top-12 z-30 w-72 rounded-2xl border border-slate-200
                 bg-white shadow-2xl shadow-slate-200/80 p-3"
          role="dialog"
          aria-label="Pick an icon"
        >
          <div class="grid grid-cols-8 gap-1 mb-3">
            @for (emoji of common; track emoji) {
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-lg text-lg
                       hover:bg-slate-100
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                (click)="pick(emoji)"
                [attr.aria-label]="'Use ' + emoji + ' as icon'"
              >
                {{ emoji }}
              </button>
            }
          </div>
          <div class="flex items-center gap-2">
            <input
              type="text"
              maxlength="4"
              placeholder="Or paste..."
              [value]="value() ?? ''"
              (input)="onCustomInput($event)"
              class="flex-1 rounded-lg border border-slate-200 bg-white
                     px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              [attr.aria-label]="'Custom icon'"
            />
            <button
              type="button"
              class="text-xs text-slate-500 hover:text-violet-700 underline"
              (click)="pick(null)"
            >
              Clear
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class DocEmojiPickerComponent {
  readonly value = input<string | null>(null);
  readonly changed = output<string | null>();

  protected readonly open = signal(false);

  protected readonly common: string[] = [
    '📄', '📝', '📚', '📖', '📕', '📗', '📘', '📙',
    '📋', '🗂️', '📁', '📂', '🗒️', '🗓️', '📅', '📆',
    '✅', '✨', '🚀', '💡', '🔥', '⭐', '🎯', '🧠',
    '🛠️', '🔧', '⚙️', '🧩', '🔍', '🔐', '🔑', '🏷️',
    '💬', '📣', '📢', '📌', '📍', '🔖', '🧵', '🗺️',
  ];

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update(v => !v);
  }

  protected pick(emoji: string | null): void {
    this.open.set(false);
    this.changed.emit(emoji);
  }

  protected onCustomInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const v = target.value?.trim();
    this.changed.emit(v ? v : null);
  }
}
