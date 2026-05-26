import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ControlContainer, FormGroup, FormGroupDirective } from '@angular/forms';
import { EMPTY } from 'rxjs';

@Component({
  selector: 'jt-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  template: `
    @if (message(); as msg) {
      <p class="mt-1.5 flex items-center gap-1.5 text-xs text-rose-400" role="alert">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {{ msg }}
      </p>
    }
  `,
})
export class FieldErrorComponent {
  private readonly container = inject(ControlContainer);

  readonly controlName = input.required<string>();
  readonly messages = input<Record<string, string>>({});

  // AbstractControl.events emits StatusChangeEvent, ValueChangeEvent,
  // TouchedChangeEvent and PristineChangeEvent — that last pair is what
  // markAllAsTouched() fires. Subscribing here means OnPush re-evaluates
  // the computed below whenever the form's touched/status changes.
  private readonly tick = toSignal(
    (this.container.control as FormGroup | null)?.events ?? EMPTY,
    { initialValue: null },
  );

  readonly message = computed<string | null>(() => {
    this.tick();
    const form = this.container.control as FormGroup | null;
    const control = form?.get(this.controlName());
    if (!control || !control.errors || (!control.touched && !control.dirty)) return null;
    const errors = control.errors;
    const custom = this.messages();
    const firstKey = Object.keys(errors)[0];
    return custom[firstKey] ?? this.defaultMessage(firstKey);
  });

  private defaultMessage(key: string): string {
    const defaults: Record<string, string> = {
      required: 'This field is required',
      email: 'Enter a valid email address',
      minlength: 'Too short',
      passwordMismatch: 'Passwords do not match',
    };
    return defaults[key] ?? 'Invalid value';
  }
}
