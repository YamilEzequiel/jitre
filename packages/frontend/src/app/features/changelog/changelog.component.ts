import { ChangeDetectionStrategy, Component } from '@angular/core';
import { APP_VERSION, REPO_RELEASES_URL } from '../../core/app-info';

type SectionType = 'Added' | 'Changed' | 'Fixed' | 'Removed' | 'Security' | 'Deprecated';

interface ReleaseSection {
  type: SectionType;
  items: string[];
}

interface Release {
  version: string;
  date: string | null;
  unreleased?: boolean;
  summary?: string;
  sections: ReleaseSection[];
}

const SECTION_STYLES: Record<SectionType, string> = {
  Added: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Changed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Fixed: 'bg-amber-50 text-amber-700 border-amber-200',
  Removed: 'bg-rose-50 text-rose-700 border-rose-200',
  Security: 'bg-purple-50 text-purple-700 border-purple-200',
  Deprecated: 'bg-slate-100 text-slate-700 border-slate-200',
};

/**
 * Single source of truth for in-app release notes.
 * Add a new release at the TOP. Keep CHANGELOG.md in sync for GitHub viewers.
 */
const RELEASES: Release[] = [
  {
    version: 'Unreleased',
    date: null,
    unreleased: true,
    summary: 'Versioning infrastructure and visible footer with repo / license.',
    sections: [
      {
        type: 'Added',
        items: [
          '<strong>/changelog</strong> page with timeline-style release history.',
          '<strong>/license</strong> page that surfaces the PolyForm Noncommercial 1.0.0 terms.',
          'Dashboard footer with current version, GitHub repo link, changelog & license.',
          'Sidebar footer links to <strong>Changelog</strong> and <strong>License</strong> (visible on every protected route).',
        ],
      },
      {
        type: 'Changed',
        items: [
          'License switched from <strong>PolyForm Internal Use 1.0.0</strong> to <strong>PolyForm Noncommercial 1.0.0</strong> — explicitly disallows commercial reselling / SaaS resale while keeping the source open for noncommercial use.',
          'Root <code>package.json</code> now declares <code>license</code>, <code>repository</code>, <code>homepage</code>, <code>bugs</code> and <code>author</code> fields.',
        ],
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-05-27',
    summary: "First tagged baseline. Snapshot of the auth & dashboard polish that landed in this session.",
    sections: [
      {
        type: 'Added',
        items: [
          'Brand-panel canvas <strong>hyperspeed effect</strong> on the auth pages (left, dark side): 220 stars in 3D perspective projection, hover accelerates 1× → 4× with eased lerp, vanishing point follows the cursor, additive HSLA brand-palette strokes for neon glow.',
          'Trail/motion-blur via per-frame translucent dark rect — no history array needed.',
          'Branded <strong>J logo</strong> on auth pages (matches favicon gradient indigo→violet→fuchsia).',
          'Live indicator badge with animated ping dot on the brand-panel.',
          'Custom branded checkboxes in login and register (<code>peer</code> + <code>appearance-none</code> + sibling SVG check).',
          'Auth-light backdrop on the form side: static, professional, indigo + sky blur blobs with subtle grid overlay.',
          'Respects <code>prefers-reduced-motion</code>, DPR-aware (capped at 2), RAF runs in <code>runOutsideAngular</code>.',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Removed the fake "Maya R." testimonial from the auth brand-panel.',
          'Replaced the comparative "Jira + Trello + Tempo · one flow" pitch with the branded line <strong>"One workspace · Zero context switching"</strong>.',
          'Auth form inputs: <code>bg-slate-100/80 border-slate-200</code> → <code>bg-white border-slate-300</code> with <code>focus:border-indigo-500 focus:ring-indigo-500/25</code>. Cleaner, no longer reads as disabled.',
          'Mobile brand bar now uses the same inline J-logo gradient as desktop.',
        ],
      },
      {
        type: 'Fixed',
        items: [
          '<strong>Inputs "turned gray" on autofill</strong>: added scoped <code>-webkit-box-shadow: 0 0 0 1000px #ffffff inset</code> to <code>jt-auth-layout input:-webkit-autofill</code> in <code>styles.css</code>. Chrome / Edge no longer override our <code>bg-white</code> with their autofill color.',
          'AI Settings panel: <code>by-user</code> / <code>by-operation</code> endpoints now receive the required <code>period</code> query param.',
        ],
      },
      {
        type: 'Removed',
        items: [
          'Static RAF-driven CSS blob orbs on the brand-panel (replaced by the hyperspeed canvas).',
          'Dual-side animated backdrop on the form column (form side is now intentionally clean).',
        ],
      },
    ],
  },
];

@Component({
  selector: 'jt-changelog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-[52rem] space-y-8 px-4 py-8 text-slate-950">
      <header class="space-y-3">
        <div class="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1">
          <span class="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true"></span>
          <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">
            Release Notes
          </span>
        </div>
        <h1 class="text-3xl font-black tracking-tight sm:text-4xl">
          <span class="block text-slate-950">What's new in</span>
          <span
            class="block bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent"
          >
            Jitre.
          </span>
        </h1>
        <p class="max-w-xl text-sm leading-relaxed text-slate-500">
          Every reform is documented here. Current release:
          <span class="font-mono text-xs font-bold tracking-tight text-slate-900">v{{ version }}</span>.
          See full history on
          <a
            [href]="releasesUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="font-semibold text-indigo-600 transition hover:text-violet-700"
          >GitHub Releases</a>.
        </p>
      </header>

      <ol class="relative space-y-6 border-l border-slate-200 pl-6">
        @for (release of releases; track release.version) {
          <li class="relative">
            <span
              class="absolute -left-[31px] top-2 flex h-3 w-3 items-center justify-center rounded-full bg-white ring-2"
              [class.ring-indigo-500]="release.unreleased"
              [class.ring-slate-300]="!release.unreleased"
              aria-hidden="true"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                [class.bg-indigo-500]="release.unreleased"
                [class.bg-slate-400]="!release.unreleased"
              ></span>
            </span>

            <article
              class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60"
            >
              <header class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <div class="flex items-baseline gap-3">
                  <h2 class="text-xl font-black tracking-tight text-slate-950">
                    v{{ release.version }}
                  </h2>
                  @if (release.unreleased) {
                    <span
                      class="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-indigo-700"
                    >
                      Unreleased
                    </span>
                  }
                </div>
                @if (release.date) {
                  <time class="text-xs font-medium text-slate-500">{{ release.date }}</time>
                }
              </header>

              @if (release.summary) {
                <p class="mb-4 text-sm leading-relaxed text-slate-600">{{ release.summary }}</p>
              }

              <div class="space-y-4">
                @for (section of release.sections; track section.type) {
                  <section>
                    <h3
                      class="mb-2 inline-flex items-center gap-2 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                      [class]="sectionStyle(section.type)"
                    >
                      {{ section.type }}
                    </h3>
                    <ul class="space-y-1.5 pl-4 text-sm text-slate-700">
                      @for (item of section.items; track item) {
                        <li class="changelog-item relative leading-relaxed" [innerHTML]="item"></li>
                      }
                    </ul>
                  </section>
                }
              </div>
            </article>
          </li>
        }
      </ol>
    </div>
  `,
  styles: [
    `
      .changelog-item {
        padding-left: 1rem;
      }
      .changelog-item::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0.55rem;
        width: 0.35rem;
        height: 0.35rem;
        border-radius: 9999px;
        background: rgb(165, 180, 252);
      }
      .changelog-item code {
        background: rgb(243, 244, 246);
        padding: 0 0.3rem;
        border-radius: 0.25rem;
        font-size: 0.82em;
        color: rgb(51, 65, 85);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .changelog-item strong {
        color: rgb(15, 23, 42);
        font-weight: 700;
      }
    `,
  ],
})
export class ChangelogComponent {
  readonly version = APP_VERSION;
  readonly releasesUrl = REPO_RELEASES_URL;
  readonly releases = RELEASES;

  sectionStyle(type: SectionType): string {
    return SECTION_STYLES[type];
  }
}
