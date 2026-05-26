import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ControlContainer, FormGroup, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { EMPTY } from 'rxjs';

@Component({
  selector: 'jt-password-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  template: `
    <div class="relative">
      <input
        [id]="id()"
        [type]="visible() ? 'text' : 'password'"
        [formControlName]="controlName()"
        [attr.autocomplete]="autocomplete()"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-describedby]="capsLockOn() ? id() + '-caps' : null"
        (keyup)="onKey($event)"
        (keydown)="onKey($event)"
        class="w-full rounded-lg border border-slate-200 bg-slate-100/80 px-4 py-3 pr-12 text-sm font-medium text-slate-900 placeholder:text-slate-600 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:ring-rose-500/30"
        [placeholder]="placeholder()"
      />
      <button
        type="button"
        (click)="toggle()"
        [attr.aria-label]="visible() ? 'Hide password' : 'Show password'"
        class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-indigo-600"
      >
        @if (visible()) {
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        } @else {
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        }
      </button>
    </div>

    @if (capsLockOn()) {
      <p [id]="id() + '-caps'" class="mt-1.5 flex items-center gap-1.5 text-xs text-amber-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 4 2 14h6v6h8v-6h6L12 4Z" />
        </svg>
        Caps Lock is on
      </p>
    }
  `,
})
export class PasswordInputComponent {
  private readonly container = inject(ControlContainer);

  readonly id = input.required<string>();
  readonly controlName = input.required<string>();
  readonly autocomplete = input<string>('current-password');
  readonly placeholder = input<string>('');

  readonly visible = signal(false);
  readonly capsLockOn = signal(false);

  private readonly tick = toSignal(
    (this.container.control as FormGroup | null)?.events ?? EMPTY,
    { initialValue: null },
  );

  readonly invalid = computed(() => {
    this.tick();
    const form = this.container.control as FormGroup | null;
    const control = form?.get(this.controlName());
    return !!control && control.invalid && control.touched;
  });

  toggle(): void {
    this.visible.update((v) => !v);
  }

  onKey(event: KeyboardEvent): void {
    const on = event.getModifierState?.('CapsLock') ?? false;
    this.capsLockOn.set(on);
  }
}
