# Changelog

All notable changes to **Jitre** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed

- **Customer screens broke the frontend bundle** because `CustomerListComponent.ngOnInit` and `CustomerDetailComponent.ngOnInit` were calling `projectStore.load(workspaceId).catch(...)`. `ProjectStore.load(projects: Project[]): void` only hydrates the cache with an already-fetched list (it does NOT fetch and does NOT return a Promise), so the calls produced `TS2345` (`string` not assignable to `Project[]`) and `TS2339` (`.catch` on `void`) and `ng serve` refused to emit a bundle. The correct primitive for "fetch + hydrate the project cache for this workspace" is `ProjectStore.onWorkspaceSwitch(workspaceId): Promise<void>` — both call sites now use that. The mistake came from assuming `ProjectStore.load` had the same signature as `CustomerStore.load(workspaceId): Promise<void>`; the two stores deliberately differ because `ProjectStore` is built on top of the entity-store factory and expects the caller to bring its own list.

---

## [0.3.0] — 2026-05-29

The "customers are first-class, observability is production-ready, and the license is finally usable in the office" release. A real `Customer` entity replaces the free-text `Project.customerName` column with a UUID FK; the command palette gets end-to-end search across 4 entity types; Prometheus `/metrics` and virtualized lists ship app-wide; and the license moves from PolyForm Noncommercial to Elastic License 2.0 so companies can deploy Jitre internally.

### Added

#### Backend — Customer module

- **New `CustomerEntity`** (`packages/backend/src/customer/customer.entity.ts`) under `customers` table. Extends `TenantEntity` so it inherits tenancy (`workspace_id`), audit (`created_at` / `updated_at` / `created_by` / `updated_by`), soft-delete (`deleted_at`) and optimistic-locking (`version`) columns. Fields: `name` (varchar 120, required), `status` (`CustomerStatus.ACTIVE` / `CustomerStatus.ARCHIVED`, default `active`), `color` (hex `#rrggbb`, required, defaults to `#2563eb` blue-600), `icon` (varchar 40, optional — accepts either a `pi-…` PrimeIcons class OR a short emoji; the frontend detects the `pi-` prefix and renders accordingly), `email`, `phone`, `taxId` (CUIT / VAT / EIN, stored verbatim), `address` and `notes` (text, 2000 chars).
- **`CustomerService`** with full CRUD plus a soft-delete that runs in a transaction: it nullifies every `projects.customer_id` pointing to the deleted customer in the same workspace before stamping `deleted_at`, so projects survive customer removal without dangling references.
- **`CustomerController`** mounted at `/api/v1/workspaces/:workspaceId/customers` with `ParseUUIDPipe` on every route param and an `assertWorkspaceMatch` guard that compares the URL workspace against the request's `req.workspace` (set by the tenancy interceptor). Endpoints: `GET /` (list, name ASC), `GET /:id`, `POST /` (ADMIN), `PATCH /:id` (ADMIN), `DELETE /:id` (ADMIN, 204). Error shape: `403 WORKSPACE_MISMATCH`, `403 INSUFFICIENT_ROLE`, `404 CUSTOMER_NOT_FOUND`, `409 CUSTOMER_NAME_TAKEN`.
- **Case-insensitive name uniqueness** within a workspace. Enforced at two levels: (1) DB partial unique index `uq_customers_workspace_name_active` over `(workspace_id, LOWER(TRIM(name)))` WHERE `deleted_at IS NULL` — so a soft-deleted customer does NOT block reuse of its name; (2) service-layer pre-check in `assertNameAvailable` so the API returns `409 CUSTOMER_NAME_TAKEN` cleanly instead of leaking a Postgres constraint violation.
- **DTO validation** (`CreateCustomerDto` / `UpdateCustomerDto`): `name` required (≤120), `color` hex-matched against `/^#[0-9a-fA-F]{6}$/`, `email` validated by `IsEmail` (≤180), all other fields optional with explicit max-lengths matching the entity. Defaults exported from `DEFAULT_CUSTOMER_COLOR = '#2563eb'`.
- **OpenAPI / Swagger** annotations on every entity property and DTO field, including `ApiResponse` codes per endpoint, so the auto-generated docs cover the customer surface end-to-end.

#### Backend — Migration `1700000003100-AddCustomers`

- Creates the `customers` table with the full tenancy contract (id, workspace_id, audit/soft-delete/version columns, all the business fields above).
- Creates `idx_customers_workspace_id` plus the partial unique index described above.
- Adds `projects.customer_id uuid NULL` with `FK fk_projects_customer` → `customers(id) ON DELETE SET NULL` and an `idx_projects_customer_id` lookup index. The `SET NULL` rule matches the application-layer soft-delete behaviour so DB-level deletes (if anyone ever runs one) cannot orphan a project.
- **Lossless backfill** of the legacy `projects.customer_name` column: groups existing projects by `(workspace_id, LOWER(TRIM(customer_name)))`, inserts one `customers` row per distinct combination with `status = 'active'` and the default blue color, then updates each project to point at the matching customer via a join on the same normalized key. Empty / whitespace-only names are skipped.
- Drops `projects.customer_name` once the backfill completes — single source of truth, no more split.
- **Reversible `down`**: re-creates `projects.customer_name`, copies names back from the FK row, drops the FK + indexes + `customer_id` column, drops both customer indexes, drops the table.

#### Backend — Project module refactor

- `ProjectEntity.customerName: string | null` removed. `ProjectEntity.customerId: string | null` added (UUID, FK to `customers(id)`).
- `ProjectEntity.areaId` now documented with `ApiPropertyOptional`.
- `CreateProjectDto` / `UpdateProjectDto`: `customerName` field replaced by `customerId` validated with `IsUUID`. Added explicit `areaId` field with `IsUUID`. Old free-text field gone.
- `ProjectService.CreateProjectDto` / `UpdateProjectDto` interfaces deleted; replaced by `CreateProjectInput` / `UpdateProjectInput` type aliases derived from the HTTP DTOs (`CreateProjectBody & { workspaceId; ownerUserId }` and `UpdateProjectBody & { actorUserId? }`). Any new DTO field now flows through the service without a parallel edit.
- `ProjectService.create` / `.update` write `customer_id` and `area_id` from the input; the legacy `customerName` path is removed entirely.

#### Shared

- `CustomerStatus` enum (`'active'` / `'archived'`) lives in `packages/shared/src/enums/customer-status.enum.ts` and is re-exported from the shared barrel so both backend and frontend consume the same string union.

#### Frontend — Customers feature

- **Routes**: `/customers` (list) and `/customers/:id` (detail), both lazy-loaded as standalone components under the main layout's authenticated routes.
- **Sidebar nav**: new "Clientes" / "Customers" entry (key `nav.customers`, icon `pi pi-id-card`) added to `MainLayoutComponent.primaryNav`, positioned right after "Projects".
- **`CustomerApiService`** (`packages/frontend/src/app/stores/customer-api.service.ts`): thin promise-returning wrapper over `firstValueFrom(http.get/post/patch/delete<…>(…))` mirroring `AreaApiService`. Exports the full `Customer`, `CreateCustomerBody` and `UpdateCustomerBody` TypeScript shapes.
- **`CustomerStore`** (`packages/frontend/src/app/stores/customer.store.ts`): signal-based workspace cache mirroring `AreaStore`. `customers = signal<Customer[]>([])`, `byId` (computed map), `active` (computed filter on status), plus `load(workspaceId)`, `upsert`, `remove`, `clear`. `load` is the fetch-and-hydrate primitive (delegates to the API service), keeping the entire screen layer free of HTTP knowledge.
- **`CustomerListComponent`** with create-customer dialog and a `projectCount(customerId)` computed via the project store.
- **`CustomerDetailComponent`** with edit-in-place form (name, status, color, icon, contact info, tax id, address, notes) and a projects-attributed-to-this-customer panel.
- **i18n**: `nav.customers` key added to `es.json` ("Clientes") and `en.json` ("Customers"); both locale files stay in sync.

#### Frontend — Project module

- `Project.customerName` removed from the `Project`, `CreateProjectBody` and `UpdateProjectBody` shapes in `project-api.service.ts`. `Project.customerId: string | null` added in its place, with a doc-comment pointing at the new `Customer` shape.
- Project create / detail / list screens now read and write `customerId` instead of the legacy free-text field.

#### Search & command palette

- **End-to-end search** — backend `/search` already indexed 6 entity types but the frontend providers only covered task + project (and were unmarshalling a phantom shape that never matched the real response). Now the command palette covers task + project + document + comment, each with a server-side `ts_headline` snippet displayed under the label and a type chip on the right. Comments resolve their parent task/project on the backend (new `parent_type` / `parent_id` columns + backfill migration `AddSearchDocParentContext1700000002900`) so a comment hit navigates to `/tasks/:id#comment-:cid` or `/projects/:id#comment-:cid` without a second round-trip.

#### Observability & production-readiness

- **Prometheus `/metrics` endpoint** at the root path (excluded from the global API prefix, matching Prom scraper conventions). Exposes default Node metrics (event loop lag, GC, heap), a per-route HTTP request counter + duration histogram (route resolved from `PATH_METADATA` so labels stay low-cardinality), BullMQ queue-depth gauges sampled every 30s for all 6 queues × 5 states, and AI usage counters (`ai_requests_total`, `ai_cost_usd_total`, `ai_tokens_total`) labelled by provider/operation/model and incremented from `ai.request_made` events.
- **Sentry bootstrap (opt-in)** — backend `observability/sentry.bootstrap.ts` and frontend `core/observability/sentry.bootstrap.ts` dynamically import `@sentry/nestjs` / `@sentry/angular` if installed and a DSN is set. No hard dependency added — install when you want it:
  - Backend: `npm i @sentry/nestjs @sentry/profiling-node -w @jitre/backend` + `SENTRY_DSN` env var
  - Frontend: `npm i @sentry/angular -w @jitre/frontend` + `window.__SENTRY_DSN__` in `index.html`
- `env.example` has the new `SENTRY_*` variables documented.
- **Readiness probe checks Redis** — `/api/v1/readyz` now pings Redis (PING under 2s timeout) on top of the existing DB + memory checks. Liveness (`/healthz`) stays minimal so a transient downstream hiccup never causes an orchestrator restart loop.
- **GitHub Actions CI** — `.github/workflows/ci.yml` runs lint + build on every PR plus backend tests against real Postgres + Redis service containers and frontend Vitest. PR + bug + feature templates under `.github/`. CI badge in README.

#### Lists & UX infrastructure

- **Virtual scrolling** across long lists. Shared `<jt-virtual-list>` switched from a broken `@for`-inside-viewport (which renders every row, defeating the point) to `*cdkVirtualFor` with a real trackBy. Applied to notifications, tickets, audit log, and the employees directory. Audit and employees tables were converted from `<table>/<tbody>/<tr>` semantics to ARIA `role=table/row/cell` grids so cdk-virtual-scroll can position rows absolutely (native tables refuse that).
- **`<jt-autosize-virtual-list>`** (variable-height variant via `@angular/cdk-experimental`) for future use on chat messages and kanban cards. Both row templates now expose `let-i="index"` alongside `$implicit` so drag-target maths can survive recycling.

#### AI — Explain on Hover

- **`POST /api/v1/ai/tasks/:taskId/explain`** returns a 2-sentence explanation of a task. Frontend exposes a reusable `<jt-ai-explain-popover [taskId]="…">` wrapper that triggers the call after 700ms of hover and shows the result in a tiny violet card with the `pi pi-sparkles` AI badge. AiService memoizes per task id for 5 minutes so flicking the mouse across a list never bills twice.

#### i18n — coverage extended

- **Remaining hardcoded surfaces** translated end-to-end: register, reset-password, main-layout chrome (mobile menu / workspace switcher / AI create button / version label / GitHub link / workspace load error toast), settings tabs (Profile / Notifications / Email / Workspace / AI / AI Prompts), the 5 settings panels themselves (every label, placeholder, help text, toast, error state — including the `{{count}} call(s)` and `{{detail}}` interpolations on the AI panel), and the entire audit log (badge, title, subtitle with `{{count}}` events, column headers, view-diff button, paginator with `{{page}}/{{shown}}/{{total}}`, diff modal labels, copy toast, load-failed toast). Both `es` and `en` files stay in sync.
- **0.2.0 surfaces** that hadn't been internationalized: navigation (Changelog / License / AI Prompts), dashboard widgets (daily digest + priority suggestions), task detail (back / prev-next / comments / AI describe), settings → AI Prompts panel, and time-tracking duration helper text. Both `es` and `en` cover the same tree.
- Sidebar Changelog and License entries now translate.
- Dashboard daily-digest and priority-suggestions widgets fully translated.
- Task detail back button, breadcrumb, prev/next aria labels, AI Describe success/failed toasts and comment composer toasts now translate.

#### Tests

- **E2E suite for AI prompt templates** — `test/ai-prompt-template.e2e-spec.ts` boots a real AppModule + Postgres, registers a user that lands as workspace OWNER, then exercises the full CRUD: create, list (with operation filter), reject invalid operation, default-swap invariant within an operation, and the "cannot delete the current default" 409.
- Backend tests for `AiPromptTemplateService` (invariants: only-one-default swap, built-in read-only, operation-scoped, default-delete refusal, `getDefaultFor`, `{{var}}` interpolation) and `AiAutoPrioritizeService` (heuristic coverage + accept/dismiss lifecycle + stale-previous-suggestion behaviour).
- Provider specs rewritten for the real Anthropic + OpenAI implementations: success path, JSON-mode, error code mapping, embeddings ordering, network errors, `AiProviderError` shape.
- Rate-card spec extended with current-model entries (`gemini-2.5-flash`, `gemini-2.5-pro`, `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `gpt-4o`, `gpt-4o-mini`, `text-embedding-3-small`).

### Changed

- **License migrated from PolyForm Noncommercial 1.0.0 to Elastic License 2.0 (ELv2).** The previous license blocked internal commercial use by companies, which was overly restrictive. ELv2 keeps the same anti-reseller posture (no hosting Jitre as a managed/SaaS service to third parties, no circumventing the licensing, no removing notices) while explicitly allowing companies to deploy and use Jitre internally — including for commercial purposes. Updated: `LICENSE`, README badge + Licencia section, `CONTRIBUTING.md`, `packages/frontend/src/app/core/app-info.ts` (`LICENSE_NAME` / `LICENSE_URL`), `packages/frontend/src/app/features/license/license.component.ts` (in-app `/license` page rewritten to reflect ELv2 terms).
- **Contributor License Agreement (CLA) introduced** to protect the dual-licensing model. New `CLA.md` (v1.0) grants the maintainer perpetual, sublicensable copyright + patent rights on Contributions, allowing future re-licensing and commercial sub-licenses while leaving authorship with the contributor. New `.github/workflows/cla.yml` runs `contributor-assistant/github-action` against every PR — first-time contributors are asked to comment a sign-off phrase on their PR, and signatures are stored in a `cla-signatures` branch in this repo (no external service). Allowlist covers the maintainer and bots (dependabot, renovate). `CONTRIBUTING.md` and the PR template updated with the CLA flow.
- **Search providers wired to the real backend shape** — task/project search providers were calling `/api/v1/search?type=...` and parsing the response as a flat array of `{id, title}` / `{id, name}`. The endpoint actually returns `{items: SearchHit[], total, page, pageSize}` with `entityId` + `snippet`, so the old code silently returned nothing. Now every provider reads `items[]`, strips the `<b>` highlight tags into a label, and feeds `snippet` into a description line below.
- **Helmet CSP enforced in production** — restrictive Content-Security-Policy, `Referrer-Policy: strict-origin-when-cross-origin`, `HSTS max-age=15552000; includeSubDomains`. Dev keeps CSP off so Angular HMR works.
- **Auth login throttle** — explicit `@Throttle({ short: { limit: 10, ttl: 60000 } })` on `POST /api/v1/auth/login` on top of the global throttler, as a layer against credential stuffing.
- **AI describe throttle** — `@Throttle({ medium: { limit: 10, ttl: 10000 }, long: { limit: 30, ttl: 60000 } })` on `POST /api/v1/ai/tasks/:id/describe` so a runaway client can't burn AI budget faster than the quota guard recalculates.
- **`env.example` JWT secrets** now carry a loud `WARNING — DO NOT SHIP THESE DEFAULTS TO PRODUCTION` block and a `_REPLACE_BEFORE_DEPLOY` suffix on the placeholder value so it's impossible to miss.

### Fixed

- **Virtual-list was not actually virtualizing** — the shared component used Angular's `@for` inside `cdk-virtual-scroll-viewport`, which renders every row. Switched to `*cdkVirtualFor` with a real `trackBy`.

### Migrating

- Run the new migration once: `npm run migration:run -w @jitre/backend`. The backfill is idempotent against an empty `customer_name` column (it does nothing) and lossless against a populated one (one customer row per case-insensitive, trimmed name per workspace).
- Frontend builds that still ship the legacy `customerName` shape will fail typecheck — pull the new `Project` interface from `@jitre/frontend/stores/project-api.service.ts` and migrate read/write sites to `customerId`. Display names should be resolved by looking the id up in `CustomerStore.byId()`.

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
