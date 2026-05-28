# Changelog

All notable changes to **Jitre** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed

- **License migrated from PolyForm Noncommercial 1.0.0 to Elastic License 2.0 (ELv2).** The previous license blocked internal commercial use by companies, which was overly restrictive. ELv2 keeps the same anti-reseller posture (no hosting Jitre as a managed/SaaS service to third parties, no circumventing the licensing, no removing notices) while explicitly allowing companies to deploy and use Jitre internally — including for commercial purposes. Updated: `LICENSE`, README badge + Licencia section, `CONTRIBUTING.md`, `packages/frontend/src/app/core/app-info.ts` (LICENSE_NAME / LICENSE_URL), `packages/frontend/src/app/features/license/license.component.ts` (in-app `/license` page rewritten to reflect ELv2 terms).
- **Contributor License Agreement (CLA) introduced** to protect the dual-licensing model. New `CLA.md` (v1.0) grants the maintainer perpetual, sublicensable copyright + patent rights on Contributions, allowing future re-licensing and commercial sub-licenses while leaving authorship with the contributor. New `.github/workflows/cla.yml` runs `contributor-assistant/github-action` against every PR — first-time contributors are asked to comment a sign-off phrase on their PR, and signatures are stored in a `cla-signatures` branch in this repo (no external service). Allowlist covers the maintainer and bots (dependabot, renovate). `CONTRIBUTING.md` and the PR template updated with the CLA flow.

### Added

- **End-to-end search** in the command palette. Backend `/search` already indexed 6 entity types but the frontend providers only covered task + project (and were unmarshalling a phantom shape that never matched the real response). Now command palette covers task + project + document + comment, each with a server-side `ts_headline` snippet displayed under the label and a type chip on the right. Comments resolve their parent task/project on the backend (new `parent_type` / `parent_id` columns + backfill migration `AddSearchDocParentContext1700000002900`) so a comment hit navigates to `/tasks/:id#comment-:cid` or `/projects/:id#comment-:cid` without a second round-trip.
- **Prometheus `/metrics` endpoint** at the root path (excluded from the global API prefix, matching Prom scraper conventions). Exposes default Node metrics (event loop lag, GC, heap), a per-route HTTP request counter + duration histogram (route resolved from `PATH_METADATA` so labels stay low-cardinality), BullMQ queue-depth gauges sampled every 30s for all 6 queues × 5 states, and AI usage counters (`ai_requests_total`, `ai_cost_usd_total`, `ai_tokens_total`) labelled by provider/operation/model and incremented from `ai.request_made` events.
- **Virtual scrolling** across long lists. Shared `<jt-virtual-list>` switched from a broken `@for`-inside-viewport (which renders every row, defeating the point) to `*cdkVirtualFor` with a real trackBy. Applied to notifications, tickets, audit log, and the employees directory. Audit and employees tables were converted from `<table>/<tbody>/<tr>` semantics to ARIA `role=table/row/cell` grids so cdk-virtual-scroll can position rows absolutely (native tables refuse that).
- **`<jt-autosize-virtual-list>`** (variable-height variant via `@angular/cdk-experimental`) for future use on chat messages and kanban cards. Both row templates now expose `let-i="index"` alongside `$implicit` so drag-target maths can survive recycling.
- **GitHub Actions CI** — `.github/workflows/ci.yml` runs lint + build on every PR plus backend tests against real Postgres + Redis service containers and frontend Vitest. PR + bug + feature templates under `.github/`. CI badge in README.
- **Readiness probe checks Redis** — `/api/v1/readyz` now pings Redis (PING under 2s timeout) on top of the existing DB + memory checks. Liveness (`/healthz`) stays minimal so a transient downstream hiccup never causes an orchestrator restart loop.
- **Sentry bootstrap (opt-in)** — backend `observability/sentry.bootstrap.ts` and frontend `core/observability/sentry.bootstrap.ts` dynamically import `@sentry/nestjs` / `@sentry/angular` if installed and DSN is set. No hard dependency added — install when you want it:
  - Backend: `npm i @sentry/nestjs @sentry/profiling-node -w @jitre/backend` + `SENTRY_DSN` env var
  - Frontend: `npm i @sentry/angular -w @jitre/frontend` + `window.__SENTRY_DSN__` in `index.html`
- `env.example` has the new `SENTRY_*` variables documented.

### Changed

- **Search providers wired to the real backend shape** — task/project search providers were calling `/api/v1/search?type=...` and parsing the response as a flat array of `{id, title}` / `{id, name}`. The endpoint actually returns `{items: SearchHit[], total, page, pageSize}` with `entityId` + `snippet`, so the old code silently returned nothing. Now every provider reads `items[]`, strips the `<b>` highlight tags into a label, and feeds `snippet` into a description line below.
- **Helmet CSP enforced in production** — restrictive Content-Security-Policy, Referrer-Policy `strict-origin-when-cross-origin`, HSTS `max-age=15552000; includeSubDomains`. Dev keeps CSP off so Angular HMR works.
- **Auth login throttle** — explicit `@Throttle({ short: { limit: 10, ttl: 60000 } })` on `POST /api/v1/auth/login` on top of the global throttler, as a layer against credential stuffing.
- **AI describe throttle** — `@Throttle({ medium: { limit: 10, ttl: 10000 }, long: { limit: 30, ttl: 60000 } })` on `POST /api/v1/ai/tasks/:id/describe` so a runaway client can't burn AI budget faster than the quota guard recalculates.
- **`env.example` JWT secrets** now carry a loud `WARNING — DO NOT SHIP THESE DEFAULTS TO PRODUCTION` block and a `_REPLACE_BEFORE_DEPLOY` suffix on the placeholder value so it's impossible to miss.

### Added (continued)

- **E2E suite for AI prompt templates** — `test/ai-prompt-template.e2e-spec.ts` boots a real AppModule + Postgres, registers a user that lands as workspace OWNER, then exercises the full CRUD: create, list (with operation filter), reject invalid operation, default-swap invariant within an operation, and the "cannot delete the current default" 409.
- **i18n** for the remaining hardcoded surfaces: register, reset-password, main-layout chrome (mobile menu / workspace switcher / AI create button / version label / GitHub link / workspace load error toast), settings tabs (Profile / Notifications / Email / Workspace / AI / AI Prompts), the 5 settings panels themselves (every label, placeholder, help text, toast, error state — including the `{{count}} call(s)` and `{{detail}}` interpolations on the AI panel), and the entire audit log (badge, title, subtitle with `{{count}}` events, column headers, view-diff button, paginator with `{{page}}/{{shown}}/{{total}}`, diff modal labels, copy toast, load-failed toast). Both `es` and `en` files stay in sync.
- **i18n keys** for the surfaces shipped in 0.2.0: navigation (Changelog / License / AI Prompts), dashboard widgets (daily digest + priority suggestions), task detail (back / prev-next / comments / AI describe), settings → AI Prompts panel, and time-tracking duration helper text. Both `es` and `en` cover the same tree.
- Sidebar Changelog and License entries now translate.
- Dashboard daily-digest and priority-suggestions widgets fully translated (badges, titles, metric labels, empty states, toasts).
- AI Prompts settings panel fully translated (badge, title, description, operation tabs, list, editor, all toasts).
- Task detail: back button, breadcrumb, prev/next aria labels, AI Describe success/failed toasts and comment composer toasts (success / file / files / failed / attachmentsFailed) now translate.
- **AI Explain on Hover** — `POST /api/v1/ai/tasks/:taskId/explain` returns a 2-sentence explanation of a task. Frontend exposes a reusable `<jt-ai-explain-popover [taskId]="…">` wrapper that triggers the call after 700ms of hover and shows the result in a tiny violet card with the `pi pi-sparkles` AI badge. AiService memoizes per task id for 5 minutes so flicking the mouse across a list never bills twice.
- Backend tests for `AiPromptTemplateService` (invariants: only-one-default swap, built-in read-only, operation-scoped, default-delete refusal, getDefaultFor, {{var}} interpolation) and `AiAutoPrioritizeService` (heuristic coverage + accept/dismiss lifecycle + stale-previous-suggestion behaviour).
- Provider specs rewritten for the real implementations (Anthropic + OpenAI): success path, JSON-mode, error code mapping, embeddings ordering, network errors, AiProviderError shape.
- Rate-card spec adds current-model entries (gemini-2.5-flash/pro, claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022, gpt-4o, gpt-4o-mini, text-embedding-3-small).

### Changed

- Cut `0.2.0` (this release). The Unreleased section above now accumulates work that lands on top.

---

## [0.2.0] — 2026-05-27

The "AI is actually the selling point" release. Multi-provider, configurable prompts, proactive features, and a Docker demo so anyone can try Jitre in 60 seconds.

### Added

#### AI — multi-provider and configurable

- **Anthropic provider** is now live (Messages API). API key via `ANTHROPIC_API_KEY`, model via `ANTHROPIC_MODEL`.
- **OpenAI provider** is now live (Chat Completions + Embeddings). API key via `OPENAI_API_KEY`, model via `OPENAI_MODEL`, embeddings via `OPENAI_EMBED_MODEL`.
- **Prompt templates per workspace**: new `ai_prompt_templates` table, full CRUD at `/api/v1/ai-prompt-templates`. Workspace admins can author their own system + user prompt with `{{variable}}` interpolation. Templates marked `is_builtin = true` are read-only.
- **6 built-in templates** seeded per workspace: *Default description*, *User Story (As-a / I want / So-that)*, *User Story (Gherkin)*, *Bug Report*, *Technical Spec*, *ADR*, plus *Default subtask breakdown* for the subtasks flow.
- **Settings → AI Prompts** panel (admin-only): tabs per operation, list + inline editor, mark-as-default, delete custom.
- **Split "AI Describe" button** on the task detail: main click uses the selected template (or workspace default), chevron opens a picker listing all describe templates.
- `describeTask` and `suggestSubtasks` accept an optional `templateId` override.

#### AI — proactive features

- **Daily digest** (`ai_daily_digests` table). Cron at 06:00 UTC iterates every workspace, asks the active provider to write a markdown narrative of yesterday's activity (tasks created/completed, comments, time logged, top contributors). Renders as a violet "Yesterday at a glance" card on the dashboard with 4 metric pills. Admins can regenerate from the UI.
- **Auto-prioritize suggestions** (`ai_priority_suggestions` table). Cron at 07:00 UTC runs a deterministic heuristic (no LLM call): overdue → URGENT, due in ≤3 days → HIGH, due in ≤7 days → MEDIUM. Surfaces as a "Prioridad recomendada" card on the dashboard with Aplicar / Descartar per row. Accepting writes the new priority through; dismissing keeps the task untouched. Admins can re-run on demand.

#### Developer experience — "try in 60 seconds"

- `compose.demo.yml` — all-in-one Docker stack (postgres + redis + backend + frontend + one-shot migrate-and-seed init container). `npm run demo:up` boots the whole product at `http://localhost:8080`.
- `Dockerfile` for backend (multi-stage, slim node:20-alpine runtime) and frontend (nginx static + reverse proxy `/api/v1` and `/ws`).
- `env.example` — every variable documented and grouped.
- `npm run setup` — orchestrator (copy env, docker up, wait DB, migrate, seed, print credentials).
- `CONTRIBUTING.md` dedicated guide.
- README "Probar en 60 segundos" section at the top.

#### Versioning + license

- `/changelog` page in the app — vertical timeline reading from a TypeScript-typed RELEASES array.
- `/license` page — surfaces PolyForm Noncommercial 1.0.0 with permitted-vs-not-permitted summary.
- Dashboard footer with version, GitHub repo, changelog & license links.
- Sidebar adds Changelog / License entries + GitHub icon + version pill on every protected route.
- `app-info.ts` single source of truth for `APP_VERSION`, `REPO_URL`, `LICENSE_NAME`.

#### Task detail — productivity polish

- **Back button** ("Volver") at the top of `/tasks/:id`. Uses `Location.back()` when there's browser history, falls back to `/projects/:id`.
- **Prev/next pill** ("N / M") with arrows in the task detail header. Navigates between top-level tasks of the current project from the local store.
- **Comments with attachments**: composer accepts file picker with chips per pending file. On submit, the comment is created first, then each attachment is uploaded in parallel with `context='comment'` and `contextId=newCommentId`.
- **Per-comment attachment badge**: "Ver adjuntos · N" (indigo, clickable) or "Sin adjuntos" (gray, non-clickable). Counts pre-fetched in parallel on comment load so no click is wasted.
- **AI describe local sync**: backend already applied the new description; the local task store now upserts the value so the UI reflects it instantly without a refetch.

#### UI consistency

- **Branded `jt-checkbox` component** (peer + `appearance-none` + sibling SVG check, ControlValueAccessor). Replaces native checkboxes in 13 files: settings panels, task-card, task-detail, create-task, ai-subtask-suggest, time-logger, custom-fields, workflow & automations editors, login, register.
- **Mention input**: textarea now shows the friendly `@Name ` form instead of the raw `@[Name](uuid)` markdown that used to leak while typing. Internal registry preserves the name → userId mapping; the encoded markdown is still what is emitted upward.
- **Time logger UX**: parser now accepts long-form units ("1h 30min", "2 hours"), comma-decimal ("1,5h") and colon notation ("1:30"). Live preview "= 1h 30m" while typing.
- **`formatEntryDate()`** helper renders ISO datetimes as "27 May 2026" instead of the raw `2026-05-27T00:00:00.000Z` that overflowed the column.
- **Linked-issues selector** now fetches the project's tasks when the user lands directly on a task detail and the store doesn't have siblings — dropdown no longer comes up empty.
- **PrimeNG `p-tabs` global light theme** override in `styles.css` (Aura's CSS-in-JS shipped dark defaults).
- Legacy Discord-era dark theme tokens removed from `styles.css` (`--color-blurple`, `--color-bg-*`, `--color-text-*`, etc) — they were declared but unused everywhere.

### Changed

- Default Gemini model bumped to `gemini-2.5-flash` (the deprecated `gemini-1.5-pro` was the previous default; a migration rewrites stored settings).
- Frontend `marked` already in dependency tree is now used for both the changelog page and the daily-digest summary rendering with `DOMPurify` sanitisation.
- Auth pages mention `Made for teams that ship` instead of the old testimonial.

### Fixed

- **AI Describe 404 on `gemini-1.5-pro`**: Google deprecated the model EOL Sept 2025. Two-layer fix — migration `1700000002500` rewrites the stored setting to `gemini-2.5-flash`, and the Gemini provider maps any deprecated model name to the current equivalent before calling the API.
- **Double scroll on task detail**: the inner `h-full overflow-auto` wrapper was redundant — the main layout already scrolls. Dropped it.
- **Dashboard body flash**: `html/body` used to default to the Discord-era dark canvas via `--color-bg-tertiary`, causing a brief dark FOUC before the layout's `bg-[#f7f8fc]` painted over. Body now defaults to the light app bg.
- **`*:focus-visible`** outline used the Discord `--color-blurple`; now uses `--color-brand-from` (indigo).

### Removed

- Static RAF-driven blob orbs on auth brand-panel (replaced by the hyperspeed canvas).
- Per-render attachment list on every comment (now behind the "Ver adjuntos" toggle so the thread stays compact).

---

## [0.1.0] — 2026-05-27

First tagged baseline. Snapshot of the auth & dashboard polish that landed in this session.

### Added

- Brand-panel canvas **hyperspeed effect** on the auth pages: 220 stars in 3D perspective projection, hover accelerates 1× → 4× with eased lerp, vanishing point follows the cursor, additive HSLA brand-palette strokes for neon glow.
- Trail/motion-blur via per-frame translucent dark rect — no history array needed.
- Branded **J logo** on auth pages (matches favicon gradient indigo→violet→fuchsia).
- Live indicator badge with animated ping dot on the brand-panel.
- Custom branded checkboxes in login and register (`peer` + `appearance-none` + sibling SVG check).
- Auth-light backdrop on the form side: static, professional, indigo + sky blur blobs with subtle grid overlay.
- Respects `prefers-reduced-motion`, DPR-aware (capped at 2), RAF runs in `runOutsideAngular`.

### Changed

- Removed the fake "Maya R." testimonial from the auth brand-panel.
- Replaced the comparative "Jira + Trello + Tempo · one flow" pitch with the branded line **"One workspace · Zero context switching"**.
- Auth form inputs: `bg-slate-100/80 border-slate-200` → `bg-white border-slate-300` with `focus:border-indigo-500 focus:ring-indigo-500/25`.
- Mobile brand bar uses the same inline J-logo gradient as desktop.

### Fixed

- **Inputs "turned gray" on autofill**: scoped `-webkit-box-shadow: 0 0 0 1000px #ffffff inset` to `jt-auth-layout input:-webkit-autofill` in `styles.css`.
- AI Settings panel: `by-user` / `by-operation` endpoints now receive the required `period` query param.

### Removed

- Static RAF-driven CSS blob orbs on the brand-panel (replaced by the hyperspeed canvas).
- Dual-side animated backdrop on the form column.

---

## Conventions

- **Version bumps**: bump `version` in root `package.json` and the matching workspace `package.json` files together. Bump `APP_VERSION` in `packages/frontend/src/app/core/app-info.ts` too — that's what the footer and changelog page show.
- **Section order per release**: Added → Changed → Fixed → Removed → Security → Deprecated.
- **Each release** must list a `## [X.Y.Z] — YYYY-MM-DD` heading. The `/changelog` page parses this format.
- **Unreleased section** at the top accumulates work that has merged but not yet been tagged.

[Unreleased]: https://github.com/YamilEzequiel/jitre/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/YamilEzequiel/jitre/releases/tag/v0.2.0
[0.1.0]: https://github.com/YamilEzequiel/jitre/releases/tag/v0.1.0
