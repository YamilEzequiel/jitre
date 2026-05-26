import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { AfterViewInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { ProjectStore } from '../../stores/project.store';
import { TaskStore } from '../../stores/task.store';
import { NotificationStore } from '../../stores/notification.store';
import { FieldErrorComponent } from '../../shared/auth/field-error.component';
import { PasswordInputComponent } from '../../shared/auth/password-input.component';

@Component({
  selector: 'jt-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, PasswordInputComponent, FieldErrorComponent],
  template: `
    <div class="space-y-7">
      <header class="space-y-3">
        <div class="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1">
          <span class="text-[9px] font-extrabold uppercase tracking-[0.18em] text-indigo-600">
            Welcome back
          </span>
        </div>
        <h2 class="text-[2rem] font-black tracking-[-0.05em] leading-[1.08] sm:text-[2.25rem]">
          <span class="block text-slate-950">
            Log in to your
          </span>
          <span class="block bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
            workspace.
          </span>
        </h2>
        <p class="max-w-[19rem] text-sm leading-relaxed text-slate-500">
          Entrá a tu workspace para seguir con proyectos, tareas y tiempos.
        </p>
      </header>

      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
        <div>
          <label for="email" class="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Email <span class="text-rose-400">*</span>
          </label>
          <input
            #emailInput
            id="email"
            type="email"
            formControlName="email"
            autocomplete="email"
            placeholder="yamil@gmail.com"
            [attr.aria-invalid]="emailInvalid() ? 'true' : null"
            class="w-full rounded-lg border border-slate-200 bg-slate-100/80 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-600 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:ring-rose-500/30"
          />
          <jt-field-error controlName="email" />
        </div>

        <div>
          <div class="flex items-baseline justify-between mb-2">
            <label for="password" class="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Password <span class="text-rose-400">*</span>
            </label>
          </div>
          <jt-password-input id="password" controlName="password" autocomplete="current-password" placeholder="Ingresá tu contraseña" />
          <jt-field-error controlName="password" [messages]="{ minlength: 'Password must be at least 6 characters' }" />
          <div class="mt-3 flex items-center justify-between gap-3">
            <label class="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                formControlName="rememberMe"
                class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
              />
              Remember me
            </label>
            <a routerLink="/reset-password" class="text-xs font-semibold text-indigo-600 transition hover:text-violet-700">
              Forgot password?
            </a>
          </div>
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
            Logging in…
          } @else {
            Log In
            <svg class="h-4 w-4 transition-transform group-hover:translate-x-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          }
        </button>

        <p class="pt-3 text-center text-xs text-slate-500">
          Need an account?
          <a routerLink="/register" class="font-bold text-indigo-600 transition hover:text-violet-700">Register</a>
        </p>
      </form>
    </div>
  `,
})
export class LoginComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly projects = inject(ProjectStore);
  private readonly tasks = inject(TaskStore);
  private readonly notifications = inject(NotificationStore);

  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  readonly loading = signal(false);

  readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    rememberMe: new FormControl(false),
  });

  private readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  readonly submitDisabled = computed(
    () => this.loading() || this.formStatus() !== 'VALID',
  );

  ngAfterViewInit(): void {
    queueMicrotask(() => this.emailInput()?.nativeElement.focus());
  }

  emailInvalid(): boolean {
    const c = this.form.get('email');
    return !!c && c.invalid && c.touched;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Revisá los campos marcados.');
      return;
    }
    this.loading.set(true);
    try {
      const { email, password } = this.form.getRawValue();
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
      let msg = 'Login failed. Please try again.';
      if (detail === 'INVALID_CREDENTIALS') msg = 'Email o contraseña incorrectos.';
      else if (detail === 'USER_INACTIVE') msg = 'Tu cuenta está deshabilitada. Contactá soporte.';
      else if (detail) msg = detail;
      else if (e?.title) msg = e.title;
      this.toast.error(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
