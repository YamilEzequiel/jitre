import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BrandPanelComponent } from '../../shared/auth/brand-panel.component';
import { ToastContainerComponent } from '../../shared/toast/toast-container.component';

@Component({
  selector: 'jt-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, BrandPanelComponent, ToastContainerComponent],
  template: `
    <div class="relative min-h-screen overflow-hidden bg-[#f6f8fc] text-slate-950">
      <jt-toast-container></jt-toast-container>

      <div
        class="pointer-events-none absolute -top-44 right-0 h-[28rem] w-[42rem] rounded-full bg-indigo-100/50 blur-3xl"
        aria-hidden="true"
      ></div>
      <div
        class="pointer-events-none absolute bottom-0 right-10 h-[24rem] w-[24rem] rounded-full bg-sky-100/60 blur-3xl"
        aria-hidden="true"
      ></div>

      <div class="relative grid min-h-screen lg:grid-cols-[1fr_1fr]">
        <jt-brand-panel />

        <div class="flex flex-col">
          <div
            class="lg:hidden flex items-center justify-center gap-2.5 border-b border-slate-200 bg-[#10152c] py-5"
          >
            <div
              class="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 shadow-md shadow-violet-500/25"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white" aria-hidden="true">
                <path d="M9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <span class="text-xl font-bold text-white">
              Jitre
            </span>
          </div>

          <main data-testid="auth-card" class="flex flex-1 items-center justify-center px-6 py-8 sm:px-12">
            <div class="w-full max-w-[24rem] rounded-[1.5rem] bg-white p-7 shadow-[0_16px_42px_rgba(15,23,42,0.06)] sm:p-9">
              <router-outlet></router-outlet>
            </div>
          </main>

          <footer class="flex items-center justify-center gap-3 px-6 py-6 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 sm:px-12">
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
