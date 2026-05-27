import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';

interface AvatarUploadResponse {
  user: { avatarUrl: string | null };
}

const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

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

      <div class="flex items-center gap-5 mb-7">
        <div class="relative">
          @if (avatarUrl(); as src) {
            <img
              [src]="src"
              alt=""
              class="h-24 w-24 rounded-full object-cover ring-2 ring-white shadow-md shadow-slate-200"
            />
          } @else {
            <div
              class="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600
                     flex items-center justify-center text-3xl font-bold text-white
                     ring-2 ring-white shadow-md shadow-slate-200"
              aria-hidden="true"
            >
              {{ initials() }}
            </div>
          }
          @if (uploading()) {
            <div class="absolute inset-0 rounded-full bg-slate-950/55 flex items-center justify-center">
              <svg class="h-7 w-7 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"></path>
              </svg>
            </div>
          }
        </div>

        <div class="space-y-1.5">
          <button
            type="button"
            (click)="fileInput.click()"
            [disabled]="uploading()"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white
                   px-3 py-1.5 text-sm font-semibold text-slate-700
                   hover:bg-slate-50 hover:border-slate-300
                   focus:outline-none focus:ring-2 focus:ring-indigo-400/60
                   disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i class="pi pi-camera text-xs" aria-hidden="true"></i>
            {{ uploading() ? 'Subiendo…' : avatarUrl() ? 'Cambiar foto' : 'Subir foto' }}
          </button>
          <p class="text-[11px] text-slate-400">PNG, JPG, WebP o GIF · máx. 2&nbsp;MB</p>
        </div>

        <input
          #fileInput
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          (change)="onFileSelected($event)"
          class="hidden"
        />
      </div>

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
  readonly uploading = signal(false);
  readonly avatarUrl = computed(() => this.auth.currentUser()?.avatarUrl ?? null);
  readonly initials = computed(() => {
    const name = this.auth.currentUser()?.displayName ?? '';
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((p) => p[0]!.toUpperCase()).join('') || '?';
  });

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

  async onFileSelected(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      this.toast.error('Formato inválido. Usá PNG, JPG, WebP o GIF.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      this.toast.error('La imagen supera el límite de 2 MB.');
      return;
    }
    this.uploading.set(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await firstValueFrom(
        this.http.post<AvatarUploadResponse>('/api/v1/users/me/avatar', fd),
      );
      this.auth.updateCurrentUser({ avatarUrl: res.user.avatarUrl });
      this.toast.success('Foto actualizada');
    } catch {
      this.toast.error('No pudimos subir la foto');
    } finally {
      this.uploading.set(false);
    }
  }
}
