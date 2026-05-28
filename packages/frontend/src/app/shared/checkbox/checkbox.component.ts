import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Branded checkbox.
 *
 * Replaces native `<input type="checkbox">` which (a) Tailwind cannot
 * recolor reliably (only `accent-color` works, and not uniformly across
 * browsers), (b) renders dark/black on some platforms even when the
 * surrounding theme is light. This component uses `peer` + `appearance-none`
 * + a sibling SVG check so the visual is fully under our control.
 *
 * Works with Reactive Forms (`[formControl]`, `formControlName`) thanks to
 * the ControlValueAccessor implementation, and with plain bindings via
 * `[checked]` / `(checkedChange)`.
 */
@Component({
  selector: 'jt-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
  template: `
    @if (label()) {
      <label
        class="group inline-flex select-none items-start gap-2.5 leading-relaxed"
        [class.cursor-pointer]="!disabledState()"
        [class.cursor-not-allowed]="disabledState()"
        [class.opacity-60]="disabledState()"
      >
        <span
          class="relative inline-flex flex-none mt-0.5"
          [class.h-3.5]="size() === 'sm'"
          [class.w-3.5]="size() === 'sm'"
          [class.h-4]="size() !== 'sm'"
          [class.w-4]="size() !== 'sm'"
        >
          <input
            type="checkbox"
            [checked]="checkedState()"
            [disabled]="disabledState()"
            (change)="onToggle($event)"
            (blur)="onBlur()"
            [attr.aria-label]="ariaLabel() || label() || null"
            class="allow-native peer absolute inset-0 h-full w-full m-0 p-0 cursor-inherit appearance-none rounded border border-slate-300 bg-white outline-none transition checked:border-emerald-500 checked:bg-white hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed"
          />
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 h-full w-full p-[2px] text-emerald-500 opacity-0 transition-opacity peer-checked:opacity-100"
          >
            <path d="M3 8.5 6.5 12 13 5" />
          </svg>
        </span>
        <span
          [class.text-xs]="size() === 'sm'"
          [class.text-sm]="size() !== 'sm'"
          class="font-medium text-slate-600 group-hover:text-slate-900"
        >
          {{ label() }}
        </span>
      </label>
    } @else {
      <span
        class="relative inline-flex flex-none align-middle"
        [class.h-3.5]="size() === 'sm'"
        [class.w-3.5]="size() === 'sm'"
        [class.h-4]="size() !== 'sm'"
        [class.w-4]="size() !== 'sm'"
        [class.cursor-pointer]="!disabledState()"
        [class.cursor-not-allowed]="disabledState()"
        [class.opacity-60]="disabledState()"
      >
        <input
          type="checkbox"
          [checked]="checkedState()"
          [disabled]="disabledState()"
          (change)="onToggle($event)"
          (blur)="onBlur()"
          [attr.aria-label]="ariaLabel() || null"
          class="allow-native peer absolute inset-0 h-full w-full m-0 p-0 cursor-inherit appearance-none rounded border border-slate-300 bg-white outline-none transition checked:border-emerald-500 checked:bg-white hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed"
        />
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 h-full w-full p-[2px] text-emerald-500 opacity-0 transition-opacity peer-checked:opacity-100"
        >
          <path d="M3 8.5 6.5 12 13 5" />
        </svg>
      </span>
    }
  `,
})
export class CheckboxComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly size = input<'sm' | 'md'>('md');

  /** External controlled value (when not using ReactiveForms). */
  readonly checked = input<boolean>(false);
  readonly checkedChange = output<boolean>();

  /** Internal signal for forms-driven value. */
  private readonly internalChecked = signal<boolean>(false);
  private readonly internalDisabled = signal<boolean>(false);
  /**
   * Tracks whether a ReactiveForms binding has attached (via writeValue).
   * MUST be a signal: if it were a plain boolean, the `checkedState`
   * computed would only track whichever signal it read on its first
   * evaluation, so the branch never switched when forms wired up
   * afterwards and the checkbox stayed visually unchecked even when the
   * FormControl held `true`.
   */
  private readonly formAttached = signal(false);

  protected readonly checkedState = computed(() =>
    this.formAttached() ? this.internalChecked() : this.checked(),
  );
  protected readonly disabledState = computed(() => this.internalDisabled());

  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected onToggle(event: Event): void {
    const next = (event.target as HTMLInputElement).checked;
    this.internalChecked.set(next);
    this.onChange(next);
    this.checkedChange.emit(next);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  // ControlValueAccessor
  writeValue(value: boolean | null | undefined): void {
    this.formAttached.set(true);
    this.internalChecked.set(!!value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.internalDisabled.set(isDisabled);
  }
}

