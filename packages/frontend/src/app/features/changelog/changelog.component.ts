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
    summary: 'Post-0.3.0 polish — bug fixes landing on top of the customers release.',
    sections: [
      {
        type: 'Fixed',
        items: [
          '<strong>Customer screens broke the frontend bundle</strong> — <code>CustomerListComponent</code> and <code>CustomerDetailComponent</code> were calling <code>projectStore.load(workspaceId).catch(...)</code>. <code>ProjectStore.load(projects: Project[]): void</code> only hydrates the cache with an already-fetched list — it does NOT fetch and does NOT return a Promise. <code>ng serve</code> refused to emit a bundle (<code>TS2345</code> + <code>TS2339</code>). Both call sites now use <code>ProjectStore.onWorkspaceSwitch(workspaceId): Promise&lt;void&gt;</code>, which is the actual fetch-and-hydrate primitive. The mistake came from assuming <code>ProjectStore.load</code> had the same signature as <code>CustomerStore.load(workspaceId)</code>; the two deliberately differ.',
        ],
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-05-29',
    summary:
      'The "customers are first-class, observability is production-ready, and the license is finally usable in the office" release. A real Customer entity replaces the free-text <code>customerName</code> column, command-palette search is wired end-to-end, Prometheus metrics + virtualized lists ship across the app, and the license moves to Elastic 2.0 so companies can deploy Jitre internally.',
    sections: [
      {
        type: 'Added',
        items: [
          '<strong>Customer module (backend)</strong> — new workspace-scoped <code>customers</code> table with full tenancy + audit + soft-delete + optimistic-locking columns. CRUD at <code>/api/v1/workspaces/:workspaceId/customers</code> guarded by <code>ParseUUIDPipe</code> + tenancy match + <code>@RequireRole(ADMIN)</code> on mutating routes. Soft-delete runs in a transaction that also nullifies every <code>projects.customer_id</code> pointing at it, so projects survive customer removal cleanly. Errors: <code>403 WORKSPACE_MISMATCH</code> / <code>INSUFFICIENT_ROLE</code>, <code>404 CUSTOMER_NOT_FOUND</code>, <code>409 CUSTOMER_NAME_TAKEN</code>.',
          '<strong>Customer migration <code>1700000003100-AddCustomers</code></strong> — creates the table, adds a partial unique index over <code>(workspace_id, LOWER(TRIM(name)))</code> WHERE <code>deleted_at IS NULL</code> (so casing variants and trailing whitespace can\'t produce duplicates, but a soft-deleted row never blocks reuse of its name), adds <code>projects.customer_id</code> with <code>FK ON DELETE SET NULL</code>, and runs a lossless backfill: one customer row per <code>(workspace, LOWER(TRIM(customer_name)))</code> group, then links each project to its match. Drops the legacy <code>projects.customer_name</code> column. Fully reversible <code>down</code>.',
          '<strong>Customer feature (frontend)</strong> — <code>/customers</code> (list) and <code>/customers/:id</code> (detail), both lazy-loaded. New sidebar entry "Clientes" / "Customers" with <code>pi pi-id-card</code>. <code>CustomerApiService</code> (promise-returning wrapper) + <code>CustomerStore</code> (signal cache mirroring <code>AreaStore</code>: <code>customers</code>, <code>byId</code>, <code>active</code>, plus <code>load/upsert/remove/clear</code>). List shows a <code>projectCount(customerId)</code> column computed from <code>ProjectStore</code>; detail edits name, status, color, icon (PrimeIcon or emoji), email, phone, tax id, address, notes.',
          '<strong><code>CustomerStatus</code> enum</strong> (<code>active</code> / <code>archived</code>) in <code>@jitre/shared</code> so backend and frontend share the same string union.',
          '<strong>End-to-end search</strong> in the command palette — task / project / document / comment results, each with a server-side <code>ts_headline</code> snippet under the label and a type chip on the right. Comments resolve their parent task or project on the backend (new <code>parent_type</code> / <code>parent_id</code> columns + backfill migration <code>AddSearchDocParentContext1700000002900</code>) so a comment hit navigates straight to <code>/tasks/:id#comment-:cid</code> without a second round-trip.',
          '<strong>Prometheus <code>/metrics</code></strong> at the root path (excluded from the global API prefix, matching Prom scraper conventions). Exposes default Node metrics (event loop lag, GC, heap), per-route HTTP request counter + duration histogram (route resolved from <code>PATH_METADATA</code> so labels stay low-cardinality), BullMQ queue-depth gauges sampled every 30s across all 6 queues × 5 states, and AI usage counters (<code>ai_requests_total</code>, <code>ai_cost_usd_total</code>, <code>ai_tokens_total</code>) labelled by provider / operation / model from <code>ai.request_made</code> events.',
          '<strong>Virtual scrolling</strong> across long lists. Shared <code>&lt;jt-virtual-list&gt;</code> switched from a broken <code>@for</code>-inside-viewport (which rendered every row, defeating the point) to <code>*cdkVirtualFor</code> with a real <code>trackBy</code>. Applied to notifications, tickets, audit log, and the employees directory. Audit and employees tables converted from <code>&lt;table&gt;/&lt;tbody&gt;/&lt;tr&gt;</code> to ARIA <code>role=table/row/cell</code> grids so cdk-virtual-scroll can position rows absolutely.',
          '<strong><code>&lt;jt-autosize-virtual-list&gt;</code></strong> (variable-height variant via <code>@angular/cdk-experimental</code>) ready for future chat-messages and kanban-cards work. Both row templates expose <code>let-i="index"</code> alongside <code>$implicit</code> so drag-target maths survive recycling.',
          '<strong>GitHub Actions CI</strong> — <code>.github/workflows/ci.yml</code> runs lint + build on every PR plus backend tests against real Postgres + Redis service containers and frontend Vitest. PR + bug + feature templates under <code>.github/</code>. CI badge in README.',
          '<strong>Readiness probe checks Redis</strong> — <code>/api/v1/readyz</code> now pings Redis (PING under 2s timeout) on top of the existing DB + memory checks. Liveness (<code>/healthz</code>) stays minimal so a transient downstream hiccup never causes an orchestrator restart loop.',
          '<strong>Sentry bootstrap (opt-in)</strong> — backend <code>observability/sentry.bootstrap.ts</code> and frontend <code>core/observability/sentry.bootstrap.ts</code> dynamically import <code>@sentry/nestjs</code> / <code>@sentry/angular</code> if installed and a DSN is set. No hard dependency added — install when you want it. <code>env.example</code> has the new <code>SENTRY_*</code> variables documented.',
          '<strong>AI Explain on Hover</strong> — <code>POST /api/v1/ai/tasks/:taskId/explain</code> returns a 2-sentence explanation. Reusable <code>&lt;jt-ai-explain-popover [taskId]="…"&gt;</code> triggers the call after 700ms of hover and shows the result in a violet card with the <code>pi pi-sparkles</code> AI badge. AiService memoizes per task id for 5 minutes so flicking the mouse across a list never bills twice.',
          '<strong>E2E suite for AI prompt templates</strong> — <code>test/ai-prompt-template.e2e-spec.ts</code> boots a real AppModule + Postgres, registers a user that lands as workspace OWNER, then exercises full CRUD: create, list (with operation filter), reject invalid operation, default-swap invariant within an operation, and the "cannot delete the current default" 409.',
          '<strong>i18n coverage</strong> extended to every remaining surface: register, reset-password, main-layout chrome (mobile menu / workspace switcher / AI create button / version label / GitHub link / workspace load error), settings tabs and the 5 settings panels (Profile / Notifications / Email / Workspace / AI / AI Prompts) including interpolated <code>{{count}}</code> and <code>{{detail}}</code> keys, the audit log with <code>{{page}}/{{shown}}/{{total}}</code> paginator + diff modal, dashboard daily-digest + priority-suggestions widgets, task detail back / prev-next / AI Describe / comment composer toasts, time-tracking duration helper, sidebar Changelog / License / AI Prompts entries. Both <code>es</code> and <code>en</code> stay in sync.',
          '<strong>Backend tests</strong> for <code>AiPromptTemplateService</code> (only-one-default swap, built-in read-only, operation-scoped, default-delete refusal, <code>getDefaultFor</code>, <code>{{var}}</code> interpolation) and <code>AiAutoPrioritizeService</code> (heuristic coverage + accept/dismiss lifecycle + stale-previous-suggestion). Provider specs rewritten for the real Anthropic + OpenAI implementations. Rate-card spec extended with current models (gemini-2.5-flash / pro, claude-3-5-sonnet / haiku 20241022, gpt-4o / mini, text-embedding-3-small).',
        ],
      },
      {
        type: 'Changed',
        items: [
          '<strong>License migrated from PolyForm Noncommercial 1.0.0 to Elastic License 2.0 (ELv2).</strong> The previous license blocked internal commercial use by companies, which was overly restrictive. ELv2 keeps the same anti-reseller posture (no hosting Jitre as a managed / SaaS service to third parties, no circumventing the licensing, no removing notices) while explicitly allowing companies to deploy and use Jitre internally — including for commercial purposes. Updated: <code>LICENSE</code>, README badge + Licencia section, <code>CONTRIBUTING.md</code>, <code>app-info.ts</code>, and the in-app <code>/license</code> page rewritten to reflect ELv2 terms.',
          '<strong>Contributor License Agreement (CLA) introduced</strong> to protect the dual-licensing model. New <code>CLA.md</code> (v1.0) grants the maintainer perpetual, sublicensable copyright + patent rights on Contributions, leaving authorship with the contributor. New <code>.github/workflows/cla.yml</code> runs <code>contributor-assistant/github-action</code> against every PR — first-time contributors comment a sign-off phrase, signatures stored in a <code>cla-signatures</code> branch (no external service). Allowlist covers the maintainer and bots (dependabot, renovate).',
          '<strong><code>Project.customerName</code> replaced by <code>Project.customerId</code></strong> — free-text column gone from both <code>ProjectEntity</code> and <code>Project</code> frontend shape, including <code>CreateProjectBody</code> / <code>UpdateProjectBody</code>. DTOs validate <code>customerId</code> with <code>IsUUID</code>. <code>ProjectService</code> input types are now derived from the HTTP DTOs (<code>CreateProjectInput = CreateProjectBody & { workspaceId; ownerUserId }</code>) so any new DTO field flows through without a parallel edit.',
          '<strong>Search providers wired to the real backend shape</strong> — task / project / document / comment providers were parsing <code>/search</code> as a flat <code>[{id, title}]</code> array. The endpoint returns <code>{items: SearchHit[], total, page, pageSize}</code> with <code>entityId</code> + <code>snippet</code>, so the old code silently returned nothing. Every provider now reads <code>items[]</code>, strips the <code>&lt;b&gt;</code> highlight tags into a label, and feeds <code>snippet</code> into a description line below.',
          '<strong>Helmet CSP enforced in production</strong> — restrictive Content-Security-Policy, <code>Referrer-Policy: strict-origin-when-cross-origin</code>, <code>HSTS max-age=15552000; includeSubDomains</code>. Dev keeps CSP off so Angular HMR works.',
          '<strong>Auth login throttle</strong> — explicit <code>@Throttle({ short: { limit: 10, ttl: 60000 } })</code> on <code>POST /api/v1/auth/login</code> on top of the global throttler, as a layer against credential stuffing.',
          '<strong>AI describe throttle</strong> — <code>@Throttle({ medium: { limit: 10, ttl: 10000 }, long: { limit: 30, ttl: 60000 } })</code> on <code>POST /api/v1/ai/tasks/:id/describe</code> so a runaway client can\'t burn AI budget faster than the quota guard recalculates.',
          '<strong><code>env.example</code> JWT secrets</strong> now carry a loud <code>WARNING — DO NOT SHIP THESE DEFAULTS TO PRODUCTION</code> block and a <code>_REPLACE_BEFORE_DEPLOY</code> suffix on the placeholder value so it\'s impossible to miss.',
        ],
      },
      {
        type: 'Fixed',
        items: [
          '<strong>Virtual-list was not actually virtualizing</strong> — the shared component used Angular\'s <code>@for</code> inside <code>cdk-virtual-scroll-viewport</code>, which renders every row. Switched to <code>*cdkVirtualFor</code> with a real <code>trackBy</code>.',
        ],
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-05-27',
    summary:
      'The "AI is actually the selling point" release. Multi-provider AI, configurable prompt templates per workspace, proactive daily digest + auto-prioritize, one-command Docker demo, and a ton of UX polish on top of the 0.1.0 baseline.',
    sections: [
      {
        type: 'Added',
        items: [
          '<strong>Multi-provider AI</strong> — Anthropic (Messages API) and OpenAI (Chat Completions + Embeddings) providers are now real implementations, not stubs. Configurable via <code>ANTHROPIC_API_KEY</code> / <code>OPENAI_API_KEY</code>.',
          '<strong>Prompt templates per workspace</strong> — table <code>ai_prompt_templates</code>, full CRUD at <code>/api/v1/ai-prompt-templates</code>, system + user prompt with <code>{{variable}}</code> interpolation.',
          '<strong>6 built-in templates</strong> seeded: Default description, User Story (As-a), User Story (Gherkin), Bug Report, Tech Spec, ADR + Default subtask breakdown.',
          '<strong>Settings → AI Prompts</strong> panel with tabs per operation, inline editor, mark-as-default, delete custom.',
          '<strong>Split AI Describe button</strong> on the task detail — chevron opens a picker listing every describe template.',
          '<strong>Daily digest</strong> — cron 06:00 UTC writes a markdown narrative of yesterday\'s workspace activity. Violet "Yesterday at a glance" card on the dashboard with 4 metric pills.',
          '<strong>Auto-prioritize suggestions</strong> — cron 07:00 UTC, heuristic-only (overdue → URGENT, ≤3 days → HIGH, ≤7 days → MEDIUM). "Prioridad recomendada" card with Aplicar / Descartar per row.',
          '<strong>Docker demo stack</strong> — <code>npm run demo:up</code> boots postgres + redis + backend + frontend + migrate-and-seed init container at <code>http://localhost:8080</code>.',
          '<strong><code>npm run setup</code></strong> orchestrator for dev mode (copy env, docker up, migrate, seed).',
          '<strong><code>CONTRIBUTING.md</code></strong> dedicated guide.',
          '<strong>Back button</strong> ("Volver") + prev/next pill ("N / M") in the task detail header.',
          '<strong>Comments with attachments</strong> — composer accepts file picker, chips per pending file, parallel uploads after the comment is created.',
          '<strong>Per-comment attachment badge</strong> ("Ver adjuntos · N" or "Sin adjuntos") — no click wasted on empty.',
          '<strong>Branded <code>jt-checkbox</code> component</strong> with <code>peer</code> + <code>appearance-none</code> + sibling SVG check + <code>ControlValueAccessor</code>. Replaces native checkboxes in 13 files.',
          '<strong>Time logger UX</strong> — parser accepts "1h 30min", "2 hours", "1,5h", "1:30". Live preview "= 1h 30m" while typing.',
          '<strong><code>formatEntryDate()</code></strong> helper renders ISO datetimes as "27 May 2026".',
          '<strong>Linked-issues selector</strong> fetches project tasks on demand when the user lands directly on a task detail.',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Default Gemini model bumped to <code>gemini-2.5-flash</code> (the deprecated <code>gemini-1.5-pro</code> was the previous default).',
          'README opens with "Probar en 60 segundos" — one Docker command and seed credentials.',
          'Mention input: textarea shows the friendly <code>@Name </code> instead of leaking <code>@[Name](uuid)</code> markdown while typing.',
          'Legacy Discord-era dark theme tokens removed from <code>styles.css</code> (<code>--color-blurple</code>, <code>--color-bg-*</code>, etc) — they were declared but unused.',
          'PrimeNG <code>p-tabs</code> global light theme override in <code>styles.css</code> so Aura\'s CSS-in-JS dark defaults no longer leak in.',
        ],
      },
      {
        type: 'Fixed',
        items: [
          '<strong>AI Describe 404 on <code>gemini-1.5-pro</code></strong>: Google retired the model EOL Sept 2025. Two-layer fix — migration <code>1700000002500</code> rewrites the stored setting; provider-level fallback maps deprecated names automatically.',
          'AI Describe now syncs the local task store with the returned description (no refetch needed).',
          'Double scroll on task detail — dropped the redundant <code>h-full overflow-auto</code> wrapper.',
          'Dashboard body flash — <code>html/body</code> defaults to the light app bg instead of the legacy dark canvas.',
          '<code>*:focus-visible</code> outline now uses <code>--color-brand-from</code> (indigo) instead of the dropped Discord <code>--color-blurple</code>.',
        ],
      },
      {
        type: 'Removed',
        items: [
          'Static RAF-driven blob orbs on auth brand-panel (replaced by the hyperspeed canvas in 0.1.0).',
          'Per-render attachment list on every comment (now behind the "Ver adjuntos" toggle so the thread stays compact).',
          'Unused Discord-era theme tokens.',
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
