import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

interface EmojiCategory {
  key: string;
  label: string;
  icon: string;
  emojis: readonly string[];
}

const CATEGORIES: readonly EmojiCategory[] = [
  {
    key: 'smileys',
    label: 'Smileys & people',
    icon: '😀',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨',
      '😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕',
      '🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮',
      '😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓',
      '😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻',
    ],
  },
  {
    key: 'gestures',
    label: 'Hand gestures',
    icon: '👍',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
      '🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️',
      '💅','🤳','💪','🦾','🦵','🦿','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁️','👅',
    ],
  },
  {
    key: 'hearts',
    label: 'Hearts',
    icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
      '💘','💝','💟','♥️','💋','💌','💐','🌹','🌷','🌸','💍','💎',
    ],
  },
  {
    key: 'animals',
    label: 'Animals & nature',
    icon: '🐶',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵',
      '🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗',
      '🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🦂',
      '🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋',
    ],
  },
  {
    key: 'food',
    label: 'Food & drink',
    icon: '🍕',
    emojis: [
      '🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝',
      '🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐',
      '🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔',
      '🍟','🍕','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛',
      '🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦',
      '🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','☕','🫖','🍵','🍶','🍾',
      '🍷','🍸','🍹','🍺','🍻','🥂','🥃','🥤','🧋','🧃','🧉','🧊',
    ],
  },
  {
    key: 'activities',
    label: 'Activities & objects',
    icon: '🎉',
    emojis: [
      '🎉','🎊','🎁','🎀','🎂','🎈','🪅','🎆','🎇','✨','🪄','🎯','🎮','🕹️','🎰','🎲',
      '🧩','🎨','🎭','🎤','🎧','🎼','🎵','🎶','🥁','🎷','🎺','🎸','🪕','🎻','📷','📸',
      '🎥','📹','💻','⌨️','🖥️','🖨️','🖱️','📱','☎️','📞','📟','📠','📺','📻','⏰','⏱️',
      '⌛','⏳','🔋','🔌','💡','🔦','🕯️','🪔','🛒','🎒','💼','📚','📖','📒','📓','📔',
      '📕','📗','📘','📙','📰','🗞️','📑','🔖','🏷️','💰','💴','💵','💶','💷','💸','💳',
      '🧾','💹','✉️','📧','📨','📩','📤','📥','📦','📫','📪','📬','📭','📮','✏️','✒️',
    ],
  },
  {
    key: 'symbols',
    label: 'Symbols',
    icon: '✅',
    emojis: [
      '✅','❌','⭕','🚫','⛔','📛','🔞','☢️','☣️','⚠️','🚸','🔱','⚜️','🔰','♻️','✳️',
      '❇️','✴️','💠','Ⓜ️','🆎','🆑','🅾️','🅿️','🆗','🆘','🆙','🆒','🆓','🆕','🆖','🆚',
      '🌀','💯','🔥','💥','💫','💦','💨','🕳️','💣','💬','👁️‍🗨️','🗨️','🗯️','💭','💤','✨',
      '❓','❔','❕','❗','‼️','⁉️','🔔','🔕','📣','📢','💹','💱','💲','⚖️','🧭','🧮',
      '⭐','🌟','🌠','☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄',
      '🌬️','💨','💧','💦','☔','☂️','🌊','🌫️','🌈','☄️','🌍','🌎','🌏','🌐','🗺️','🧭',
    ],
  },
];

@Component({
  selector: 'jt-emoji-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      role="dialog"
      aria-label="Emoji picker"
    >
      <header class="border-b border-slate-100 px-3 py-2">
        <input
          type="text"
          [value]="query()"
          (input)="onSearch($event)"
          placeholder="Search emoji…"
          aria-label="Search emoji"
          class="w-full rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none
                 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-violet-300"
        />
      </header>

      @if (!query()) {
        <nav
          class="flex items-center gap-0.5 border-b border-slate-100 px-1.5 py-1.5"
          role="tablist"
          aria-label="Emoji categories"
        >
          @for (cat of categories; track cat.key) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeCategory() === cat.key"
              [attr.aria-label]="cat.label"
              [title]="cat.label"
              (click)="activeCategory.set(cat.key)"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition
                     hover:bg-slate-100"
              [class.bg-violet-100]="activeCategory() === cat.key"
            >
              {{ cat.icon }}
            </button>
          }
        </nav>
      }

      <div class="max-h-64 overflow-y-auto px-2 py-2">
        @if (visibleEmojis().length === 0) {
          <p class="px-2 py-6 text-center text-xs text-slate-400">No emojis match.</p>
        } @else {
          <div class="grid grid-cols-8 gap-0.5">
            @for (emoji of visibleEmojis(); track emoji) {
              <button
                type="button"
                (click)="onPick(emoji)"
                [attr.aria-label]="emoji"
                class="flex aspect-square items-center justify-center rounded-md text-lg
                       transition hover:bg-violet-50 focus:outline-none focus:ring-2
                       focus:ring-violet-300"
              >
                {{ emoji }}
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class EmojiPickerComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly picked = output<string>();
  readonly dismissed = output<void>();

  readonly categories = CATEGORIES;
  readonly activeCategory = signal<string>(CATEGORIES[0].key);
  readonly query = signal('');

  readonly visibleEmojis = computed<readonly string[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (q) {
      const all = CATEGORIES.flatMap(c => c.emojis);
      return Array.from(new Set(all));
    }
    const active = CATEGORIES.find(c => c.key === this.activeCategory());
    return active?.emojis ?? [];
  });

  constructor() {
    fromEvent<MouseEvent>(this.document, 'click')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        const target = event.target as Node | null;
        if (target && !this.host.nativeElement.contains(target)) {
          this.dismissed.emit();
        }
      });

    fromEvent<KeyboardEvent>(this.document, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        if (event.key === 'Escape') this.dismissed.emit();
      });
  }

  onPick(emoji: string): void {
    this.picked.emit(emoji);
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.query.set(input.value);
  }
}
