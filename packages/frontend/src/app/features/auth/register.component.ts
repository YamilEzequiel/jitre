import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { AfterViewInit } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { ProjectStore } from '../../stores/project.store';
import { TaskStore } from '../../stores/task.store';
import { NotificationStore } from '../../stores/notification.store';
import { FieldErrorComponent } from '../../shared/auth/field-error.component';
import { PasswordInputComponent } from '../../shared/auth/password-input.component';
import { PasswordStrengthMeterComponent } from '../../shared/auth/password-strength-meter.component';
import { CheckboxComponent } from '../../shared/checkbox/checkbox.component';
import { toSignal } from '@angular/core/rxjs-interop';

function passwordMatch(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!confirm) return null;
  return pw === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'jt-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PasswordInputComponent,
    PasswordStrengthMeterComponent,
    FieldErrorComponent,
    CheckboxComponent,
  ],
  template: `
    <div class="space-y-5">
      <header class="space-y-2.5">
        <div class="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1">
          <span class="text-[9px] font-extrabold uppercase tracking-[0.18em] text-indigo-600">
            Get started
          </span>
        </div>
        <h2 class="text-[1.85rem] font-black tracking-[-0.05em] leading-[1.08] sm:text-[2.1rem]">
          <span class="block text-slate-950">
            Create your
          </span>
          <span class="block bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
            account.
          </span>
        </h2>
        <p class="text-sm leading-relaxed text-slate-500">
          Cre&aacute; tu cuenta y arranc&aacute; con proyectos, tableros y registro de tiempo.
        </p>
      </header>

      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-3.5" novalidate>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label for="reg-email" class="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Email <span class="text-rose-400">*</span>
          </label>
          <input
            id="reg-email"
            type="email"
            formControlName="email"
            autocomplete="email"
            placeholder="yamil@gmail.com"
            class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 aria-[invalid=true]:border-rose-400"
          />
          <jt-field-error controlName="email" />
        </div>

        <div>
          <label for="name" class="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Display Name <span class="text-rose-400">*</span>
          </label>
          <input
            #nameInput
            id="name"
            type="text"
            formControlName="name"
            autocomplete="name"
            placeholder="Maya Rodríguez"
            class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 aria-[invalid=true]:border-rose-400"
          />
          <jt-field-error controlName="name" />
        </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label for="reg-password" class="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Password <span class="text-rose-400">*</span>
          </label>
          <jt-password-input id="reg-password" controlName="password" autocomplete="new-password" placeholder="8+ caracteres" />
          <jt-password-strength-meter [value]="passwordValue() ?? ''" />
          <jt-field-error controlName="password" [messages]="{ minlength: 'Password must be at least 8 characters' }" />
        </div>

        <div>
          <label for="confirm-password" class="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Confirm Password <span class="text-rose-400">*</span>
          </label>
          <jt-password-input id="confirm-password" controlName="confirmPassword" autocomplete="new-password" placeholder="Repetir clave" />
          @if (form.errors?.['passwordMismatch'] && form.get('confirmPassword')?.touched) {
            <p class="mt-1.5 flex items-center gap-1.5 text-xs text-rose-400" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Passwords do not match
            </p>
          }
        </div>
        </div>

        <div class="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600">
          <jt-checkbox formControlName="acceptTerms" ariaLabel="Accept terms" />
          <span>
            I agree to Jitre's
            <a href="/terms" class="font-semibold text-indigo-600 transition hover:text-violet-700">Terms of Service</a>
            and
            <a href="/privacy" class="font-semibold text-indigo-600 transition hover:text-violet-700">Privacy Policy</a>
          </span>
        </div>

        <button
          type="submit"
          [disabled]="submitDisabled()"
          class="group inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-white
                 bg-gradient-to-r from-indigo-500 to-violet-500
                 shadow-lg shadow-indigo-500/25
                 hover:shadow-xl hover:shadow-indigo-500/35
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                 transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
        >
          @if (loading()) {
            <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"></path>
            </svg>
            Creating account&hellip;
          } @else {
            Continue
            <svg class="h-4 w-4 transition-transform group-hover:translate-x-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          }
        </button>

        <p class="pt-1 text-center text-xs text-slate-500">
          Already have an account?
          <a routerLink="/login" class="font-bold text-indigo-600 transition hover:text-violet-700">Log in</a>
        </p>
      </form>
    </div>
  `,
})
export class RegisterComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly projects = inject(ProjectStore);
  private readonly tasks = inject(TaskStore);
  private readonly notifications = inject(NotificationStore);

  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  readonly loading = signal(false);

  readonly form = new FormGroup(
    {
      name: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required, Validators.minLength(8)]),
      confirmPassword: new FormControl('', [Validators.required]),
      acceptTerms: new FormControl(false, [Validators.requiredTrue]),
    },
    { validators: passwordMatch },
  );

  readonly passwordValue = toSignal(this.form.controls.password.valueChanges, {
    initialValue: this.form.controls.password.value,
  });

  private readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  readonly submitDisabled = computed(
    () => this.loading() || this.formStatus() !== 'VALID',
  );

  ngAfterViewInit(): void {
    queueMicrotask(() => this.nameInput()?.nativeElement.focus());
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Revisá los campos marcados.');
      return;
    }
    const { name, email, password } = this.form.getRawValue();
    this.loading.set(true);
    try {
      await this.auth.register({ displayName: name!, email: email!, password: password! });
      await this.auth.login({ email: email!, password: password! });
      const workspace = this.auth.currentWorkspace();
      if (workspace) {
        await Promise.allSettled([
          this.projects.onWorkspaceSwitch(workspace.id),
          this.tasks.onWorkspaceSwitch(workspace.id),
          this.notifications.onWorkspaceSwitch(workspace.id),
        ]);
      }
      await this.router.navigate(['/']);
    } catch (err: unknown) {
      const e = (err as { error?: { detail?: string; title?: string } })?.error;
      const detail = e?.detail ?? '';
      let msg = 'Registration failed. Please try again.';
      if (detail === 'EMAIL_TAKEN') msg = 'Ese email ya está registrado. Probá iniciar sesión.';
      else if (detail === 'WEAK_PASSWORD') msg = 'La contraseña es muy débil. Usá al menos 8 caracteres.';
      else if (detail) msg = detail;
      else if (e?.title) msg = e.title;
      this.toast.error(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
