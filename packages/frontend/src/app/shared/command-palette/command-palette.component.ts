import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommandPaletteService } from './command-palette.service';
import type { CommandResult } from './recent-items.helper';

@Component({
  selector: 'jt-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (paletteService.isOpen()) {
      <div
        data-testid="command-palette-dialog"
        class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4
               bg-slate-950/70 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        (keydown)="onKeydown($event)"
      >
        <div
          class="w-full max-w-xl overflow-hidden rounded-2xl
                 border border-white/15 bg-slate-900/90 backdrop-blur-xl
                 shadow-2xl shadow-indigo-500/20 ring-1 ring-white/5"
        >
          <div class="relative">
            <svg
              class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              #queryInput
              type="text"
              class="w-full pl-11 pr-4 py-3.5 text-sm bg-transparent text-white
                     placeholder:text-gray-500 outline-none border-b border-white/10"
              placeholder="Type a command or search…"
              aria-label="Command palette search"
              (input)="onInput($event)"
              (keydown)="onKeydown($event)"
            />
          </div>
          <ul
            class="max-h-80 overflow-y-auto py-1.5"
            role="listbox"
          >
            @for (result of results(); track result.id; let i = $index) {
              <li
                role="option"
                [attr.aria-selected]="i === activeIndex()"
                [class]="
                  'flex items-center gap-3 mx-1.5 my-0.5 px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ' +
                  (i === activeIndex()
                    ? 'bg-gradient-to-r from-indigo-600/30 to-violet-600/30 text-white border border-indigo-400/30'
                    : 'text-gray-200 border border-transparent hover:bg-white/5')
                "
                (click)="execute(result)"
              >
                <span
                  [class]="
                    'h-1.5 w-1.5 rounded-full flex-none ' +
                    (i === activeIndex()
                      ? 'bg-gradient-to-r from-indigo-400 to-violet-400'
                      : 'bg-white/20')
                  "
                  aria-hidden="true"
                ></span>
                <span class="flex-1 truncate">{{ result.label }}</span>
              </li>
            } @empty {
              <li class="px-4 py-6 text-center text-sm text-gray-500">
                Type to search…
              </li>
            }
          </ul>
          <div
            class="flex items-center justify-between px-4 py-2 border-t border-white/10
                   bg-white/[0.02] text-[10px] text-gray-500"
          >
            <span class="inline-flex items-center gap-2">
              <kbd
                class="inline-flex items-center rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-semibold text-gray-300"
              >↑↓</kbd>
              navigate
            </span>
            <span class="inline-flex items-center gap-2">
              <kbd
                class="inline-flex items-center rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-semibold text-gray-300"
              >↵</kbd>
              select
            </span>
            <span class="inline-flex items-center gap-2">
              <kbd
                class="inline-flex items-center rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-semibold text-gray-300"
              >esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    }
  `,
})
export class CommandPaletteComponent {
  readonly paletteService = inject(CommandPaletteService);

  private readonly _results = signal<CommandResult[]>([]);
  readonly results = this._results.asReadonly();

  private readonly _activeIndex = signal<number>(0);
  readonly activeIndex = this._activeIndex.asReadonly();

  private readonly _maxIndex = computed(() => Math.max(0, this.results().length - 1));

  onInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this._activeIndex.set(0);
    this.paletteService.search(query).then(r => this._results.set(r));
  }

  onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        this.paletteService.close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this._activeIndex.update(i => Math.min(i + 1, this._maxIndex()));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this._activeIndex.update(i => Math.max(0, i - 1));
        break;
      case 'Enter': {
        const active = this.results()[this._activeIndex()];
        if (active) this.execute(active);
        break;
      }
    }
  }

  execute(result: CommandResult): void {
    result.action();
    this.paletteService.recents.add(result);
    this.paletteService.close();
  }
}
