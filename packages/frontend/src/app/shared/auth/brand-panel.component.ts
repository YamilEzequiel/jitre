import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'jt-brand-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    <aside
      class="relative hidden h-full min-h-screen overflow-hidden bg-gradient-to-br from-[#11162e] via-[#11162d] to-[#171529] px-10 py-10 text-white lg:flex lg:flex-col xl:px-12"
    >
      <div
        class="pointer-events-none absolute -left-28 top-28 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
        aria-hidden="true"
      ></div>
      <div
        class="pointer-events-none absolute -bottom-12 right-0 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl"
        aria-hidden="true"
      ></div>

      <div class="relative flex items-center gap-2">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white" aria-hidden="true">
            <path d="M9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </div>
        <span class="text-lg font-bold text-white">
          Jitre
        </span>
      </div>

      <div class="relative mt-5 max-w-xl space-y-7 xl:mt-6">
        <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true"></span>
          <span class="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Jira + Trello + Tempo &middot; one flow
          </span>
        </div>

        <h1 class="text-[3.15rem] font-black leading-[1.03] tracking-[-0.065em] xl:text-[3.5rem]">
          <span class="block text-white">Plan, ship</span>
          <span class="mt-1 block bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
            and measure.
          </span>
        </h1>

        <p class="max-w-md text-sm leading-relaxed text-slate-400">
          Projects, boards, docs, chat, AI and time tracking in a workspace built for teams that need clarity, not another scattered toolchain.
        </p>

        <div class="grid grid-cols-2 gap-3 pt-1">
          @for (feature of features; track feature.label) {
            <div class="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.055] px-4 py-3.5 transition-colors hover:bg-white/[0.08]">
              <div class="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/[0.07] text-indigo-300">
                <span [class]="'pi text-xs ' + feature.icon" aria-hidden="true"></span>
              </div>
              <span class="text-xs font-semibold text-slate-300">{{ feature.label }}</span>
            </div>
          }
        </div>
      </div>

      <div class="relative mt-auto rounded-xl border border-white/[0.06] bg-white/[0.055] p-4">
        <div class="flex items-start gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-xs font-bold text-white">
            M
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2">
              <span class="text-xs font-semibold text-white">Maya R.</span>
              <span class="text-[10px] font-medium uppercase tracking-wide text-slate-500">&middot; Eng Lead</span>
            </div>
            <p class="mt-1 text-xs italic leading-relaxed text-slate-400">
              &ldquo;Finally, one place for roadmap, execution and time visibility.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </aside>
  `,
})
export class BrandPanelComponent {
  readonly features = [
    { label: 'Kanban boards', icon: 'pi-clone' },
    { label: 'Sprint focus', icon: 'pi-bolt' },
    { label: 'Tempo-style time', icon: 'pi-clock' },
    { label: 'Realtime docs', icon: 'pi-file' },
  ] as const;
}
