import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_VERSION, LICENSE_NAME, REPO_URL } from '../../core/app-info';

@Component({
  selector: 'jt-app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <footer
      class="mt-10 border-t border-slate-200/70 bg-white/40 px-6 py-4 backdrop-blur-sm"
    >
      <div
        class="mx-auto flex max-w-[70rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[11px] text-slate-500"
      >
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span class="inline-flex items-center gap-2 font-semibold text-slate-600">
            <span class="inline-flex h-4 w-4 overflow-hidden rounded-[3px]" aria-hidden="true">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="h-full w-full">
                <defs>
                  <linearGradient id="footer-brand-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#6366f1" />
                    <stop offset="60%" stop-color="#8b5cf6" />
                    <stop offset="100%" stop-color="#d946ef" />
                  </linearGradient>
                </defs>
                <rect width="64" height="64" rx="14" fill="url(#footer-brand-grad)" />
                <path
                  d="M40 14 v26 a10 10 0 0 1 -10 10 h-2 a10 10 0 0 1 -10 -10 v-2 h8 v2 a4 4 0 0 0 4 4 h2 a4 4 0 0 0 4 -4 V14 z"
                  fill="#ffffff"
                />
              </svg>
            </span>
            Jitre
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              v{{ version }}
            </span>
            <a
              routerLink="/changelog"
              class="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500 transition hover:text-indigo-700"
            >
              Changelog
            </a>
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a
            [href]="repoUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 font-semibold text-slate-500 transition hover:text-slate-900"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.57.11.78-.25.78-.55v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.45.11-3.03 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.74.11 3.03.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.07.78 2.16v3.2c0 .31.21.67.79.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
            </svg>
            GitHub
          </a>
          <a
            routerLink="/license"
            class="font-semibold text-slate-500 transition hover:text-slate-900"
          >
            {{ licenseName }}
          </a>
          <span class="hidden text-slate-300 sm:inline">&copy; 2026 Jitre</span>
        </div>
      </div>
    </footer>
  `,
})
export class AppFooterComponent {
  readonly version = APP_VERSION;
  readonly repoUrl = REPO_URL;
  readonly licenseName = LICENSE_NAME;
}
