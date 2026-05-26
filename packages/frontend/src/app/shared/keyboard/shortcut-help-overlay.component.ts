import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  KeyboardShortcutService,
  ShortcutDefinition,
} from '../../core/keyboard/keyboard-shortcut.service';

interface ShortcutGroup {
  context: string;
  shortcuts: ShortcutDefinition[];
}

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? navigator.userAgent);

function formatKey(key: string): string {
  return key
    .replace(/cmd/g, isMac ? '⌘' : 'Ctrl')
    .replace(/alt/g, isMac ? '⌥' : 'Alt')
    .replace(/shift/g, isMac ? '⇧' : 'Shift')
    .replace(/\+/g, '+');
}

@Component({
  selector: 'jt-shortcut-help-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl
             p-6 shadow-2xl shadow-indigo-500/20 ring-1 ring-white/5"
      role="dialog"
      aria-label="Keyboard shortcuts"
    >
      <header class="space-y-3 mb-6">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full
                 border border-white/15 bg-white/5 backdrop-blur-sm"
        >
          <span
            class="text-[10px] font-bold uppercase tracking-[0.18em]
                   bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300
                   bg-clip-text text-transparent"
          >
            Help
          </span>
        </div>
        <h2 class="text-xl font-black tracking-tight">
          <span class="bg-gradient-to-b from-white via-white to-white/70 bg-clip-text text-transparent">
            Keyboard Shortcuts
          </span>
        </h2>
      </header>
      @for (group of groups(); track group.context) {
        <div class="mb-5 last:mb-0">
          <h3
            class="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-2"
          >
            {{ group.context }}
          </h3>
          <ul class="space-y-1.5">
            @for (shortcut of group.shortcuts; track shortcut.key) {
              <li class="flex items-center justify-between text-sm gap-3">
                <span class="text-gray-200">{{ shortcut.key }}</span>
                <kbd
                  class="inline-flex items-center rounded border border-white/15 bg-white/5
                         px-2 py-0.5 text-[11px] font-mono font-semibold text-gray-300"
                >
                  {{ display(shortcut.key) }}
                </kbd>
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `,
})
export class ShortcutHelpOverlayComponent {
  private readonly shortcutService = inject(KeyboardShortcutService);

  readonly groups = computed<ShortcutGroup[]>(() => {
    const all = this.shortcutService.getAll();
    const map = new Map<string, ShortcutDefinition[]>();
    for (const s of all) {
      const ctx = s.context ?? 'Global';
      if (!map.has(ctx)) map.set(ctx, []);
      map.get(ctx)!.push(s);
    }
    return Array.from(map.entries()).map(([context, shortcuts]) => ({ context, shortcuts }));
  });

  display(key: string): string {
    return formatKey(key);
  }
}
