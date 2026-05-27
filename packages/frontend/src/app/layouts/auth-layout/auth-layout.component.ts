import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BrandPanelComponent } from '../../shared/auth/brand-panel.component';
import { AuthLightBackdropComponent } from '../../shared/auth/auth-light-backdrop.component';
import { ToastContainerComponent } from '../../shared/toast/toast-container.component';

@Component({
  selector: 'jt-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, BrandPanelComponent, AuthLightBackdropComponent, ToastContainerComponent],
  template: `
    <div class="relative min-h-[100dvh] overflow-x-hidden bg-[#f6f8fc] text-slate-950">
      <jt-toast-container></jt-toast-container>

      <div class="relative grid min-h-[100dvh] lg:grid-cols-[1fr_1fr]">
        <jt-brand-panel />

        <div class="relative flex flex-col min-h-[100dvh]">
          <jt-auth-light-backdrop />

          <!-- Compact mobile brand bar — only shows below lg -->
          <div
            class="relative z-10 lg:hidden flex items-center justify-center gap-2 bg-gradient-to-r from-[#0b0f24] via-[#11162d] to-[#171529] px-4 py-3"
          >
            <span class="inline-flex h-7 w-7 overflow-hidden rounded-md shadow-md shadow-indigo-500/30" aria-hidden="true">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="h-full w-full">
                <defs>
                  <linearGradient id="brand-mobile-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#6366f1" />
                    <stop offset="60%" stop-color="#8b5cf6" />
                    <stop offset="100%" stop-color="#d946ef" />
                  </linearGradient>
                </defs>
                <rect width="64" height="64" rx="14" fill="url(#brand-mobile-grad)" />
                <path
                  d="M40 14 v26 a10 10 0 0 1 -10 10 h-2 a10 10 0 0 1 -10 -10 v-2 h8 v2 a4 4 0 0 0 4 4 h2 a4 4 0 0 0 4 -4 V14 z"
                  fill="#ffffff"
                />
              </svg>
            </span>
            <span class="text-base font-bold tracking-tight text-white">Jitre</span>
          </div>

          <main data-testid="auth-card" class="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
            <div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06)] sm:p-8 lg:rounded-[1.5rem] lg:p-9">
              <router-outlet></router-outlet>
            </div>
          </main>

          <footer class="relative z-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 sm:px-8 sm:py-6 lg:px-12">
            <span>&copy; 2026 Jitre</span>
            <a href="/terms" class="transition hover:text-indigo-600">Terms</a>
            <a href="/privacy" class="transition hover:text-indigo-600">Privacy</a>
          </footer>
        </div>
      </div>
    </div>
  `,
})
export class AuthLayoutComponent {}
