import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';

@Component({
  selector: 'jt-user-settings-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <section
      class="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7
             shadow-sm shadow-slate-200/70"
    >
      <h2 class="text-xl font-bold tracking-tight text-slate-950 mb-6">Profile</h2>
      <form [formGroup]="form" (ngSubmit)="save()" class="space-y-5 max-w-md" novalidate>
        <div>
          <label
            for="user-name"
            class="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2"
          >
            Name <span class="text-rose-400">*</span>
          </label>
          <input
            id="user-name"
            type="text"
            formControlName="displayName"
            class="w-full rounded-lg bg-white border border-slate-200
                   px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400
                   outline-none transition
                   focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <div>
          <label
            for="user-email"
            class="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2"
          >
            Email <span class="text-rose-400">*</span>
          </label>
          <input
            id="user-email"
            type="email"
            formControlName="email"
            class="w-full rounded-lg bg-white border border-slate-200
                   px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400
                   outline-none transition
                   focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <button
          type="submit"
          [disabled]="form.invalid || saving()"
          class="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white
                 bg-gradient-to-r from-indigo-600 to-violet-600
                 shadow-md shadow-indigo-500/25
                 hover:shadow-lg hover:shadow-indigo-500/40
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                 transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
        >
          @if (saving()) {
            <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"></path>
            </svg>
            Saving…
          } @else {
            Save Changes
          }
        </button>
      </form>
    </section>
  `,
})
export class UserSettingsPanelComponent {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly saving = signal(false);
  readonly form = this.fb.group({
    displayName: [this.auth.currentUser()?.displayName ?? '', Validators.required],
    email: [this.auth.currentUser()?.email ?? '', [Validators.required, Validators.email]],
  });

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.http.patch('/api/v1/users/me', this.form.value));
      this.toast.success('Profile updated');
    } catch {
      this.toast.error('Failed to save profile');
    } finally {
      this.saving.set(false);
    }
  }
}
