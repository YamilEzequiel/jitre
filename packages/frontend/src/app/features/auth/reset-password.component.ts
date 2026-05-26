import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { AfterViewInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { FieldErrorComponent } from '../../shared/auth/field-error.component';

@Component({
  selector: 'jt-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, FieldErrorComponent],
  template: `
    <div class="space-y-8">
      @if (!submitted()) {
        <header class="space-y-3">
          <div
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full
                   border border-blue-200 bg-blue-50 backdrop-blur-sm"
          >
            <span
              class="text-[10px] font-bold uppercase tracking-[0.18em]
                     bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-600
                     bg-clip-text text-transparent"
            >
              Recover
            </span>
          </div>
          <h2 class="text-3xl sm:text-4xl font-black tracking-tight leading-[1.05]">
            <span class="block bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent">
              Reset your
            </span>
            <span class="block bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">
              password.
            </span>
          </h2>
          <p class="text-sm text-slate-600">
            Ingresá tu email y te mandamos un link seguro para volver a entrar.
          </p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-5" novalidate>
          <div>
            <label
              for="reset-email"
              class="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2"
            >
              Email <span class="text-rose-400">*</span>
            </label>
            <input
              #emailInput
              id="reset-email"
              type="email"
              formControlName="email"
              autocomplete="email"
              class="w-full rounded-lg bg-white border border-slate-200
                     px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400
                     outline-none transition
                     focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30
                     aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:ring-rose-500/30"
            />
            <jt-field-error controlName="email" />
          </div>

          <button
            type="submit"
            [disabled]="loading()"
            class="group w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white
                   bg-gradient-to-r from-blue-700 to-indigo-700
                   shadow-md shadow-blue-500/25
                   hover:shadow-lg hover:shadow-blue-500/40
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                   focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                   transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
          >
            @if (loading()) {
              <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"></path>
              </svg>
              Sending…
            } @else {
              Send Reset Link
              <svg class="h-4 w-4 transition-transform group-hover:translate-x-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            }
          </button>
        </form>
      } @else {
        <div class="space-y-6 text-center">
          <div
            class="mx-auto flex h-16 w-16 items-center justify-center rounded-full
                   bg-gradient-to-br from-blue-100 to-cyan-100
                   border border-blue-200 shadow-lg shadow-blue-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-blue-700"
              aria-hidden="true"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div class="space-y-2">
            <h2 class="text-2xl font-black tracking-tight">
              <span class="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent">
                Check your inbox
              </span>
            </h2>
            <p class="text-sm text-slate-600">
              If that email exists, a reset link is on its way.
            </p>
          </div>
        </div>
      }

      <p class="text-sm text-slate-500">
        <a
          routerLink="/login"
          class="inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:text-blue-800 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to login
        </a>
      </p>
    </div>
  `,
})
export class ResetPasswordComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  readonly loading = signal(false);
  readonly submitted = signal(false);

  readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  ngAfterViewInit(): void {
    queueMicrotask(() => this.emailInput()?.nativeElement.focus());
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email } = this.form.getRawValue();
    this.loading.set(true);
    try {
      await this.auth.requestReset(email!);
      this.submitted.set(true);
      this.toast.success('Reset link sent!');
    } catch {
      this.toast.error('Could not send reset link. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
