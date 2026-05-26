import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface StrengthLevel {
  readonly score: number;
  readonly label: string;
  readonly color: string;
  readonly hint: string;
}

@Component({
  selector: 'jt-password-strength-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-2 space-y-1.5" [attr.aria-live]="'polite'">
      <div class="flex gap-1">
        @for (i of [0, 1, 2, 3]; track i) {
          <div
            class="h-1 flex-1 rounded-full transition-colors duration-200"
            [class]="i < level().score ? level().color : 'bg-slate-200'"
          ></div>
        }
      </div>
      @if (value()) {
        <div class="flex items-center justify-between text-xs">
          <span [class]="textColor()">{{ level().label }}</span>
          <span class="text-slate-500">{{ level().hint }}</span>
        </div>
      }
    </div>
  `,
})
export class PasswordStrengthMeterComponent {
  readonly value = input.required<string>();

  readonly level = computed<StrengthLevel>(() => {
    const v = this.value() ?? '';
    if (!v) {
      return { score: 0, label: '', color: 'bg-slate-200', hint: '' };
    }

    let score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/\d/.test(v) || /[^A-Za-z0-9]/.test(v)) score++;

    const tiers: ReadonlyArray<Omit<StrengthLevel, 'score'>> = [
      { label: 'Weak', color: 'bg-rose-500', hint: 'Use at least 8 characters' },
      { label: 'Weak', color: 'bg-rose-500', hint: 'Add upper & lowercase' },
      { label: 'Fair', color: 'bg-amber-400', hint: 'Add numbers or symbols' },
      { label: 'Good', color: 'bg-emerald-500', hint: 'Almost there' },
      { label: 'Strong', color: 'bg-emerald-500', hint: '' },
    ];
    return { score, ...tiers[score] };
  });

  readonly textColor = computed(() => {
    const s = this.level().score;
    if (s <= 1) return 'text-rose-400';
    if (s === 2) return 'text-amber-400';
    return 'text-emerald-400';
  });
}
