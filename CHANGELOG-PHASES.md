# Jitre — Phase Changelog

Each phase is implemented as a coherent slice. This file documents what landed, key decisions, and explicit TODOs.

---

## Fase 1 — Foundation

### Goal
Set the chassis. Everything else builds on this. No domain features.

### Decisions
- **Monorepo:** npm workspaces. Three packages under `packages/`: `shared`, `backend`, `frontend`. Path alias `@jitre/shared` resolves via `tsconfig.base.json` + workspace symlink in `node_modules`.
- **ORM:** TypeORM 0.3 with explicit `DataSource` (`src/database/data-source.ts`). No `forRoot` with options inline — DataSource is the single source of truth for migrations and runtime.
- **Naming:** `SnakeNamingStrategy` (TypeORM) — DB columns snake_case, TS code camelCase.
- **BaseEntity** carries: `id` (uuid), `createdAt`, `updatedAt`, `deletedAt` (soft delete via `@DeleteDateColumn`), `createdBy`, `updatedBy`, `version` (`@VersionColumn` for optimistic locking).
- **TenantEntity** extends BaseEntity with `workspaceId` (FK to workspace, filled by TenancyInterceptor in Fase 2).
- **RequestContext** uses Node's `AsyncLocalStorage` (`nestjs-cls` package). Carries `requestId`, `userId`, `workspaceId`. Auto-populated by an HTTP middleware reading `Authorization` (resolved fully in Fase 2) and `x-workspace-id` headers.
- **AuditSubscriber** (TypeORM EntitySubscriber) auto-fills `createdBy` and `updatedBy` from RequestContext on insert/update.
- **Logger:** `nestjs-pino`. Pretty in dev (`pino-pretty`), JSON in prod. Correlation IDs via `x-request-id` header (auto-generated if missing).
- **Validation:** global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true, transform: true`.
- **Exception filter:** global `AllExceptionsFilter` returns RFC 7807-style problem JSON with `requestId`.
- **Security:** `helmet` (default CSP off for Swagger), CORS via env whitelist, `@nestjs/throttler` (in-memory now, Redis later in Fase 5).
- **API:** URI versioning. All routes under `/api/v1/...`. Swagger at `/api/v1/docs`.
- **Health:** `@nestjs/terminus` checks DB + memory. Liveness at `/api/v1/healthz`, readiness at `/api/v1/readyz`.
- **First migration:** only PG extensions (`uuid-ossp`, `pg_trgm`). No tables — those come in Fase 2 with `User`/`Workspace`.

### TODOs handed to next phases
- `RequestContext.userId` is read but not populated yet. Wired by `JwtAuthGuard` in **Fase 2**.
- `TenantEntity.workspaceId` is read but not validated yet. `TenancyInterceptor` activates in **Fase 2**.
- `AuditSubscriber.createdBy/updatedBy` defaults to `null` until Fase 2 supplies authenticated users.
- Throttler uses in-memory store. Swap to Redis in **Fase 5**.

---

## Fase 2 — Identity, Auth, RBAC, Sessions, Tenancy activa

### Goal
Resolve Fase 1's identity TODOs. Activate tenancy. Land enterprise auth surface.

### Decisions
- **JWT**: `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`. HS256.
- **Refresh tokens**: opaque random 256-bit hex, SHA-256-hashed at rest in `sessions`. Rotated in place. Optimistic strategy on concurrent rotation — second use returns 401.
- **CSRF**: double-submit cookie, scoped to `/auth/refresh`. `crypto.timingSafeEqual` for compare.
- **Password hashing**: `@node-rs/argon2`. Async-only. Env-driven params; tests use weak params.
- **RBAC**: CASL (`@casl/ability`) with attribute-level rules per `WorkspaceRole`. Ability cached per-request in CLS (`RC_KEYS.ABILITY`).
- **Tenancy**: global `TenancyInterceptor` runs after `JwtAuthGuard`. Reads `x-workspace-id`. Validates membership. Populates `RequestContext.workspaceId + role`. `@SkipTenancy()` for routes that don't need workspace context.
- **Cookies**: `refresh` httpOnly, Secure (prod), SameSite=Strict, path=`/api/v1/auth`. `csrf` Secure, SameSite=Strict, path=`/api/v1/auth`.
- **Email**: stored in `citext` column for case-insensitive uniqueness. Requires `citext` extension (added in dedicated migration before Fase 2 tables).
- **Membership**: one `WorkspaceMembership` per (user, workspace). Single role per row. Service-level check prevents removing the last OWNER.
- **Module wiring**: `JwtAuthGuard` and `TenancyInterceptor` registered as APP_GUARD / APP_INTERCEPTOR in `AuthModule`. Global by default; opt-out via `@Public()` and `@SkipTenancy()`.

### TODOs handed to next phases
- Session list + revoke UI: Fase 7 (frontend) or earlier admin panel.
- Refresh token chain history (parent/child tracking): Fase 3 once event bus is in place.
- Email verification + password reset flows: not in scope — handled in a later identity phase.
- OAuth and magic links: not planned for short-term.
- Removal of `nestjs-cls` legacy peer warning: monitor upstream.
- Pre-existing `base.entity.spec.ts` failures (2 tests, Fase 1 design bug): TODO to fix before Fase 3 starts.

---

---

## Fase 3 — Event Bus, Audit, Notifications, Activity Timeline

### Goal
Add an in-process event bus, append-only audit log, multi-driver notification system, an activity timeline read-view, and a mention parser. Retrofit Fase 2 services (AuthService, WorkspaceService) to emit domain events.

### Decisions

- **Event bus**: `@nestjs/event-emitter` (EventEmitter2) as sync in-process transport. `EventBusService` wraps it behind a `publish` / `subscribe` API. Transport is swappable without touching callers (Fase 5 target: BullMQ).
- **Domain events**: abstract `DomainEvent<P>` base; 9 concrete events covering the user/session/workspace/mention lifecycle. Events carry `eventId` (UUID v4), `occurredAt`, `aggregateId`, `aggregateType`, `actorUserId`, `workspaceId`, and a typed `payload`.
- **Audit**: single `audit_logs` table (append-only). `AuditLogListener` uses wildcard `@OnEvent('**')` — any new event becomes auditable without code changes. Idempotency enforced via `UNIQUE (event_id)` — duplicate emits are caught and the existing row returned (no exception bubbles to caller).
- **scrubSensitive**: pure recursive util that redacts keys matching `/password|token|secret|api[_-]?key|authorization/i` before storing payloads in `diff`. Does not mutate input. Handles circular references.
- **Notifications**: multi-driver architecture via `NOTIFICATION_DRIVERS` symbol + `multi: true`. `NotificationDispatcherService` fans-out to every driver with per-driver isolation (one driver throwing does not prevent others). Drivers: `InAppNotificationDriver` (writes DB row) and `EmailNotificationDriver` (stub — logs `[STUB email]`, real driver is Fase 5+).
- **Activity timeline**: `ActivityTimelineService` is a thin projection over `AuditLog` — no separate table. Consolidation (e.g., "Alice added Bob and Carol") is documented as a future optimization (Fase 6+).
- **Mention parser**: `MentionParser` supports `@[name](uuid)` and bare `@uuid` syntax. De-duplicates. Not wired to any caller in Fase 3; Fase 4 (Comments) injects it.
- **Retrofit ordering**: `WorkspaceService.create()` is the single source of truth for `workspace.created` and `workspace.member.added(OWNER)` events. `AuthService.register()` emits only `user.registered` and `session.created`. This prevents duplicate events on the register flow.
- **logoutAll granularity**: `AuthService.logoutAll` emits one `SessionRevokedEvent` per active session (not one aggregate event) to support per-session audit granularity.

### TODOs handed to next phases

- **Transactional outbox** (Fase 5): events are emitted after the DB commit returns. A process crash between commit and `eventBus.publish` loses the event. Mitigation: add a `domain_outbox` table and a poll-then-publish worker in Fase 5.
- **Real email driver** (Fase 5+): `EmailNotificationDriver` is a logged stub. Interface is frozen now to prevent breakage when a real driver lands.
- **MentionParser caller** (Fase 4 — Comments): `MentionParser` is fully tested but has no caller in Fase 3. The `MentionModule` ships a comment referencing Fase 4.
- **Notification retention policy**: unbounded growth in Fase 3. Add TTL archival in operations or Fase 5.
- **ActivityTimeline consolidation**: 1:1 mapping from `AuditLog` in Fase 3. Grouped summaries ("Alice added Bob, Carol, and Dave") deferred to Fase 5+.
- **PII leakage guard**: `scrubSensitive` is key-regex based. New sensitive payload keys that don't match the regex will leak into `diff`. Require explicit review when adding new event payload shapes.

(Following phases will be appended here as they land.)

---

## Fase 4 — Storage, Comments, Attachments

### Goal
Add binary file storage, polymorphic attachment model, a threaded comment system with mention wiring, and the supporting domain events.

### Decisions

- **Storage driver pattern**: `IStorageDriver` interface abstracts `put` / `get` / `delete` / `getSignedUrl`. Three drivers ship: `LocalStorageDriver` (filesystem, dev), `S3StorageDriver` (AWS SDK v3), `R2StorageDriver` (extends S3 with endpoint override for Cloudflare). Selected via `STORAGE_DRIVER` env. `StorageModule.forRoot()` is `@Global()` — injects `STORAGE_DRIVER` token everywhere.

- **HMAC-signed local URLs**: local driver does not redirect to cloud — it serves files through `FilesController` (`@Public()`, `@SkipTenancy()`). URLs carry an HMAC-SHA256 signature seeded by `STORAGE_LOCAL_SIGNING_SECRET`. `signed-url.util.ts` uses `crypto.timingSafeEqual` for constant-time compare. `path-builder.util.ts` sanitizes filenames (strips `..`, non-printable chars) before constructing storage keys.

- **Polymorphic Attachment**: single `attachments` table. `context` (`AttachmentContext` enum) + `contextId` identify the parent entity without FKs (avoids cross-module coupling). Avatar endpoints (`POST /users/me/avatar`, `POST /workspaces/:id/avatar`) use `replaceAvatar()` — soft-deletes the previous avatar before uploading the new one.

- **file-type@16 (CJS fallback)**: `file-type@^19` is pure ESM and cannot be required in a Jest + ts-jest CommonJS transform environment. `file-type@16.5.4` is the last CommonJS release; downgraded and pinned. Import uses `require()` inside `mime-validator.util.ts` to avoid TypeScript ESM resolution. **Revisit when Jest supports ESM cleanly** (tracked as tech debt).

- **Polymorphic Comment + 2-level threading**: `comments` table has `parent_id` self-FK (nullable). Service enforces max 2 levels: creating with a `parentId` fetches the parent and throws `BadRequestException('MAX_THREAD_DEPTH')` if `parent.parentId !== null`. No DB-level constraint — depth is service-enforced.

- **7-day edit window**: `update()` checks `now - comment.createdAt > 7 days` and throws `ForbiddenException('EDIT_WINDOW_EXPIRED')`. Only the author can edit (ADMIN cannot edit on behalf). Delete is author-or-ADMIN.

- **MentionParser wired into CommentService**: `MentionParser` (from `MentionModule`) is injected into `CommentService`. On `create()`, all parsed mentions emit `MentionCreatedEvent`. On `update()`, a set diff (new mentions minus old mentions) fires `MentionCreatedEvent` only for **newly added** user IDs. Mentions are capped at 50 per comment — excess entries are sliced and a warning is logged.

- **5 new domain events**: `CommentCreatedEvent`, `CommentUpdatedEvent`, `CommentDeletedEvent`, `AttachmentUploadedEvent`, `AttachmentDeletedEvent`. All extend `DomainEvent<P>` base. `AuditLogListener` ACTION_MAP extended for all 5.

- **Soft-delete-only**: physical file removal is deferred. `AttachmentService.softDelete()` marks the DB row with `deletedAt` and emits `AttachmentDeletedEvent`. Actual storage key cleanup (driver `delete()` call) is a Fase 5 BullMQ worker responsibility.

### TODOs handed to next phases

- **BullMQ for physical file cleanup** (Fase 5): when `AttachmentDeletedEvent` fires, a worker should call `driver.delete(storageKey)`. Not in Fase 4 scope.
- **Real email driver** (Fase 5+): `EmailNotificationDriver` is still a logged stub from Fase 3. Interface is frozen.
- **Advanced threading** (future): current max-depth is 2. A full nested-thread model (unlimited depth with `path` or `lft/rgt` MPTT) is deferred.
- **E2E tests** (deferred — Fase 5 setup): G1–G5 spec files are written under `packages/backend/test/`. They require Docker + PG migration. Run with `POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend`.
- **Migration B3**: `1700000000300-Fase4StorageAttachmentsComments.ts` is written and unit-tested but not executed against a live DB (Docker unavailable during apply). Run `npm run db:migration:run -w @jitre/backend` to apply.
- **file-type ESM**: when Jest adds native ESM support, upgrade `file-type` to `@^19` and remove the `require()` workaround in `mime-validator.util.ts`.

---

## Fase 5 — Background Jobs, Search, Settings

### Goal

Add a durable job queue layer (BullMQ + ioredis), a full-text search engine (Postgres tsvector as default, ES stub behind interface), a typed settings facade with 4 scopes and precedence resolution, and notification dispatcher gating. Closes the Fase 1 throttler TODO by upgrading to Redis-backed storage.

### Decisions

- **BullMQ + ioredis with named queues**: `@nestjs/bullmq` over a globally-registered `BullModule.forRootAsync`. Five operational queues: `cleanup`, `email`, `search-indexer`, `analytics` (future), `ai` (future). Default job options: 3 attempts, exponential backoff, auto-clean completed (1h age, 100 count) and failed (7d age). ioredis-mock injected via jest `moduleNameMapper` for all unit tests.

- **JobLog table audits via QueueEventsListener**: failed/completed/active/waiting events are captured by a per-queue `QueueEventsListener` subclass (each extending `BaseJobTrackerSubscriber`) into the `job_logs` table. Durable 90-day audit window; prune scheduler runs weekly. Payload sanitizer registry strips keys matching `/token|secret|password|signature|key/i` by default; per-job-type sanitizers can be registered.

- **Bull Board mounted at `/api/v1/admin/queues`** (env-gated via `ENABLE_BULL_BOARD`, defaults to `false` in prod). Auth middleware (`JwtAuthMiddleware` + `RoleMiddleware([ADMIN, OWNER])`) is registered via `consumer.apply().forRoutes(...)` before the Express adapter router is mounted in `main.ts` — guard order is ensured and test-covered.

- **SearchEngine interface with PgFullTextSearchEngine (tsvector GIN) + ES stub**: `ISearchEngine` seam (`SEARCH_ENGINE` Symbol) decouples callers from storage. Default engine uses Postgres `tsvector`, `plainto_tsquery('simple', ...)`, `ts_headline` for snippets, and a GIN index. `ElasticsearchEngine` is a stub that throws `NotImplementedException`. Engine selected via factory in `SearchModule`.

- **SettingsService typed facade with 4 scopes + precedence**: `UserSetting`, `WorkspaceSetting`, `AiSetting`, `NotificationSetting` entities map to distinct repository calls. Precedence chain for notification keys: **per-user-per-workspace > per-user-global > workspace > default**. All getters default to `DEFAULT_VALUES[key] ?? passedDefault`; setters call `assertKnownKey` before upsert. Unknown key → `BadRequestException('unknown_setting_key')`.

- **NotificationDispatcher honors settings flags per driver**: before each `driver.send(...)`, the dispatcher calls `settingsService.getNotificationSetting(recipientUserId, workspaceId, settingKey, true)`. Key mapping: `in-app` → `notification.in_app`, `email` → `notification.email`. Default is `true` (opt-out, not opt-in) — existing behaviour preserved when no settings are configured. Per-dispatch cache (Map) avoids N×M DB round-trips.

- **Throttler upgraded to Redis storage via `@nest-lab/throttler-storage-redis`**: closes the Fase 1 TODO. Three named throttlers replace the single unnamed throttler: `short` (3/1s), `medium` (20/10s), `long` (100/60s). Factory uses `ConfigService` to read redis config; `ThrottlerStorageRedisService` is constructed with host/port/password from the redis namespace. `@nestjs/throttler-storage-redis` does not exist on npm — the correct package is `@nest-lab/throttler-storage-redis`.

- **3 scheduled jobs**: `CleanupScheduler` fires daily at 03:00 UTC enqueuing `attachments.cleanup-soft-deleted`; `JobLogPruneScheduler` fires weekly at 04:00 UTC Sunday. All `@Cron` decorators force `{ timeZone: 'UTC' }`.

- **Indexer**: `IndexerListener` handles `comment.created`, `comment.updated`, `comment.deleted`, `workspace.created`, `workspace.updated`, `user.profile.updated` — each enqueues an `entity.index` job. `IndexEntityProcessor` builds content strings per entity type, runs an `INSERT … ON CONFLICT DO UPDATE` with `to_tsvector('simple', content)`. Pluggable for Fase 6 (tasks, projects).

### TODOs handed to next phases

- **Real ElasticSearch implementation** (Fase 8): `ElasticsearchEngine` is a stub. Interface is frozen.
- **Advanced search ranking**: `boost` column reserved per `SearchDocument`; per-entity-type tuning deferred to Fase 8.
- **Real email driver** (Fase 5+): `EmailNotificationDriver` is still a logged stub. Interface frozen.
- **Notification batching**: `notification.batching.window_minutes` setting is stored and resolved but no batching worker exists yet.
- **Analytics + AI queue processors** (Fase 8): queues are registered, subscribers are wired, processors are empty stubs.
- **Migration B3 (Fase 5)**: `1700000000400-Fase5JobsSearchSettings.ts` is written and unit-tested but not run against live DB (Docker unavailable during apply). Run `npm run migration:run -w @jitre/backend`.
- **E2E specs H1–H5** are written under `packages/backend/test/` but require Docker (Postgres + Redis). Run with `POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend`.

---

## Fase 6 — Domain Core: Projects + Tasks

### Goal

Full project and task domain with lexicographic ordering (Lexorank), custom workflow statuses, labels, custom fields, project membership/RBAC, due-soon scheduling, search integration for tasks + projects, and notification settings for all new domain events.

### Decisions

- **Migration 1700000000500-Fase6DomainCore**: 8 new tables — `statuses`, `labels`, `custom_fields`, `projects`, `project_memberships`, `tasks`, `task_assignments`, `task_labels`. All FK constraints explicit; `tasks.parent_task_id` uses ON DELETE SET NULL (ADR-7). `tasks.rank` (varchar, not null) holds Lexorank string. GIN index on `tasks.custom_fields` (jsonb).

- **Lexorank (ADR-4)**: in-house `LexorankService` using base-26 alphabetic strings. `between(a, b)` computes a midpoint; `between(x, x)` throws `LexorankCollisionError`; `between(null, null)` returns `'n'` (initial). On collision the caller must trigger a rebalance (Fase 7 target). No external library dependency.

- **Status as entity (ADR-5)**: `StatusEntity` has nullable `projectId` — workspace-level defaults when null, project-scoped otherwise. `StatusService.ensureDefaults()` seeds 4 default statuses per project on `ProjectService.create()` inside a transaction. `listByProject` falls back to workspace defaults when no project-specific statuses exist.

- **StatusCategory enum**: `TODO`, `IN_PROGRESS`, `DONE` (shared enum in `@jitre/shared`). Entering DONE via `TaskService.changeStatus()` sets `completedAt` and emits `TaskCompletedEvent` alongside `TaskStatusChangedEvent` (ADR-12).

- **Status delete with replace (ADR-8)**: if tasks reference the status being deleted, `StatusService.delete()` requires `replaceWithStatusId` in the request body (400 otherwise).

- **Project archive blocked by active tasks (ADR-9)**: `ProjectService.archive()` counts non-deleted tasks; throws `ConflictException` (409) if count > 0.

- **2-level task nesting max (ADR-11)**: `TaskService.create()` loads the parentTask and checks `parentTask.parentTaskId !== null`; throws 400 if so.

- **Project RBAC (Fase 6 CASL extension)**: `createForUserInProject(userId, workspaceId, projectId, wsRole, projectRole?)` factory added to `ability.factory.ts`. Layered on top of workspace ability: workspace OWNER/ADMIN can manage any project; project ADMIN can manage tasks/members; project MEMBER can create/update tasks; VIEWER read-only.

- **Search integration (ADR-D14)**: `IndexerListener` extended with `task.*`, `project.*`, `label.updated` (fan-out re-indexing). `IndexEntityProcessor.buildContent('task')` denormalizes label names. `DomainEventOpts` extended with optional `eventId` for deterministic IDs from `DueSoonScheduler`.

- **DueSoonScheduler**: cron `EVERY_DAY_AT_8AM` UTC. Reads `notification.task_due_soon_window_days` per workspace from `SettingsService`. EventId = `sha256('task.due_soon:' + taskId + ':' + dueDate.toDateString())` — idempotent re-runs on same calendar day.

- **Settings keys extended**: `KNOWN_KEYS.notification` += `task_assigned`, `task_due_soon`, `task_completed`, `task_status_changed`, `project_member_added` (boolean, default true). `KNOWN_KEYS.workspace` += `task_due_soon_window_days` (number, default 3) — workspace-scoped because it controls scheduling behaviour globally, not per-user.

- **NotificationListener extended**: 5 new `@OnEvent` handlers gate dispatch on the corresponding `notification.*` setting per recipient. Per-assignee fan-out for multi-assignee events (due_soon, status_changed, completed).

- **Module wiring**: `StatusModule`, `LabelModule`, `CustomFieldModule` (with `CustomFieldValidator`), `ProjectModule` (imports all three), `TaskModule` (imports ProjectModule + SettingsModule + ScheduleModule). `SearchModule` adds `TaskLabelEntity` for `IndexerListener`. `JobsModule` adds entity repos for `IndexEntityProcessor` (entity class references, not string tokens). `ProjectModule` + `TaskModule` added to `AppModule`.

### TODOs handed to next phases

- **Migration run**: `1700000000500-Fase6DomainCore.ts` is written and unit-tested but not executed against live DB (Docker unavailable during apply). Run `npm run migration:run -w @jitre/backend`.
- **E2E specs (I1–I5)**: `project-lifecycle.e2e-spec.ts`, `task-lifecycle.e2e-spec.ts`, `task-search.e2e-spec.ts`, `task-due-soon.e2e-spec.ts`, `rbac-project.e2e-spec.ts` written but require Docker. Run with `POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend`.
- **Lexorank rebalance** (Fase 7): when `LexorankCollisionError` is thrown during reorder, a rebalance job should rebuild all ranks for the project. Deferred.
- **Real email driver**: still a logged stub from Fase 3.
- **Frontend**: project/task UI in Fase 7 (Angular).
- **`createUserFixture` signature**: E2E fixtures assume `createUserFixture(app, email, workspaceId?, ownerToken?)` — verify and align with Fase 5 fixture if the signature differs.


---

## Fase 7 — Realtime + AI

### Goal

WebSocket real-time event bridge (Socket.IO + Redis pub/sub) and AI assistant features (Gemini 2.0 Flash) with full quota enforcement, provider abstraction, and CASL permissions.

### Decisions (ADR-1 through ADR-15 — see design artifact)

- **ADR-1 (Single /ws namespace)**: One Socket.IO namespace `/ws` with room-based tenancy. `user:<id>`, `workspace:<id>` rooms auto-joined on connect. `project:<id>` and `task:<id>` rooms joined on explicit client subscribe with membership verification.

- **ADR-2 (decimal(12,6) for cost)**: `AiUsageRecord.costUsd` stored as `numeric(12,6)` string in TypeScript — no float drift. Big.js used for comparisons.

- **ADR-3 (Stub providers throw)**: `AnthropicProvider` and `OpenAiProvider` throw `NotImplementedException` — fail loudly on misconfiguration.

- **ADR-4 (Sync AI in Fase 7)**: AI calls are synchronous HTTP (Gemini Flash p95 ≈ 2s). BullMQ `ai` queue exists but no processor wired — Fase 8 item.

- **ADR-5 (WsJwtMiddleware in realtime/)**: Co-located with gateway; imports `JwtService` from `AuthModule`. One-way dependency: realtime → auth.

- **ADR-6 (AiUsageRecord never soft-deleted)**: Extends `TenantEntity` for schema consistency but `deletedAt` is never set by `AiUsageService`.

- **ADR-7 (totalTokens stored)**: Avoids GENERATED column TypeORM quirks; AiService always sets all three token counts at insert.

- **ADR-8 (Explicit @OnEvent per relay event)**: `RealtimeListener` has one typed handler per `RealtimeEvent` enum value. No wildcard.

- **ADR-9 (IDs-only payloads)**: Every `RealtimeEventPayloads` entry carries IDs only — clients refetch via REST after receiving event.

- **ADR-10 (AiQuotaGuard eventually consistent)**: No advisory lock on quota check. Acceptable ≤ ~10 cents overage at 99% budget with concurrent requests.

- **ADR-11 (NotificationCreatedEvent in NotificationService.create)**: Single emit point — realtime relay works regardless of upstream notification source.

- **ADR-12 (WebSocket-only transport)**: `transports: ['websocket']` — no long-poll fallback.

- **ADR-13 (Redis token bucket for backpressure)**: Per-socket outgoing rate limit via Redis INCR + TTL.

- **ADR-14 (Reuse Fase 5 Redis + socketio: prefix)**: Same Redis config; separate key namespace.

- **ADR-15 (Per-feature gates in controllers)**: `AiService.generateCompletion` checks only `ai.enabled` (global kill). Feature gates (`ai.task_describe_enabled`, etc.) belong to the controller.

### Key technical choices

- **AiModule @Global()**: exports `AiService + AiUsageService + AiQuotaGuard` so future modules inject without re-import.
- **String injection tokens**: `AiController` uses `@Inject('TaskService')` and `@Inject('CommentService')` — AiModule provides them via `useExisting`. Controller spec keeps string tokens for mock isolation.
- **CASL extensions (I1/I2)**: `Action` type extended with `use_ai` + `manage_ai_settings`. `Subject` extended with `AiUsageRecord + Realtime`. WORKSPACE_MEMBER granted `use_ai`; WORKSPACE_ADMIN additionally granted `manage_ai_settings + read AiUsageRecord`.
- **V2 fix (K1)**: `DueSoonScheduler` skips tasks with `status.category === 'done'` (post-load filter on LEFT JOIN result).
- **V4 fix (K2)**: CONTRIBUTOR update/delete scoped to `{ creatorUserId: userId }` condition in `createForUserInProject`.
- **J2 validators**: `setAiSetting` validates `ai.daily_budget_usd > 0`; `setWorkspaceSetting` validates `notification.task_due_soon_window_days` is a positive integer.
- **H1 (NotificationCreatedEvent)**: `NotificationService.create` emits event after INSERT — enables realtime notification relay to recipient's `user:<id>` room.
- **RedisIoAdapter**: try/catch in `main.ts` — falls back to in-memory adapter if Redis unavailable (dev/test without Docker).

### New packages installed

- `@nestjs/websockets` — WebSocket decorators
- `@nestjs/platform-socket.io` — Socket.IO adapter bridge

### Test counts

| Batch | Tests added | Running total |
|---|---|---|
| Batch 1 (A–F + J1) | 128 | 899 |
| Batch 2 (G–N) | 54 | 953 |

### TODOs handed to next phases

- **Migration run**: `1700000000600-Fase7RealtimeAi.ts` is written and unit-tested but not executed against live DB. Run `npm run migration:run -w @jitre/backend`.
- **E2E specs (M1–M4)**: `realtime-event-bridge.e2e-spec.ts`, `ai-describe.e2e-spec.ts`, `ai-quota.e2e-spec.ts`, `ai-rbac.e2e-spec.ts` written with `describe.skip` — require Docker (Postgres + Redis + live Socket.IO). Run: `POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend`.
- **Backpressure middleware**: Redis token-bucket per-socket rate limiter designed (ADR-13, §3.5) but not implemented. Fase 8 item.
- **Kickout on membership revocation**: `RealtimeListener.onProjectMemberRemoved` calls `server.in().socketsLeave()` — requires Redis adapter to work cross-instance. Fallback no-op in test.
- **AiUsageListener 80% warning**: `@OnEvent('ai.request_made')` handler that emits `AI_QUOTA_WARNING` notification at ≥80% daily budget (deduped by sha256 eventId) — deferred.
- **AiController RequireAbility**: `@RequireAbility(use_ai, Workspace)` decorator wiring on AI controller endpoints deferred (CASL extended in I1/I2; decorator application is a one-liner per endpoint for Fase 8).
- **Anthropic + OpenAI providers**: stubs. Fase 8 replaces with real implementations.
- **Embed consumer**: `GeminiProvider.embed` is implemented; no use-case wires it yet. Fase 8 semantic search.
- **Streaming endpoint**: Synchronous API in Fase 7; `generateStream` implemented in `GeminiProvider` but not exposed via HTTP. Fase 8.
- **Real email driver**: still a logged stub from Fase 3.

---

## Fase 8 — Analytics + AI Analytics

### Goal

Read-only on-demand analytics over existing domain data (tasks, statuses, audit logs) and AI usage records. No new storage tables — pure TypeORM QueryBuilder reads. Adds WebSocket subscription quota, Redis backpressure middleware, and a SQL-level DONE filter for DueSoonScheduler.

### Decisions (ADRs)

- **ADR-1 (percentile via SQL)**: `percentile_cont(0.5) WITHIN GROUP (ORDER BY ...)` for lead-time and cycle-time medians. Pure SQL avoids loading raw rows into Node memory.
- **ADR-2 (UTC ISO 8601 Monday-start week bucketing)**: `to_char(date_trunc('week', ...),'IYYY-"W"IW')` for week labels. Monday is week-start per ISO 8601. Gap-fill uses `dayOfWeek===0 ? 6 : dayOfWeek-1` to compute Monday offset.
- **ADR-3 (generate_series CTE for gap-fill + end-of-day burndown)**: CTE generates one row per period (day, week, month) and LEFT JOINs to aggregate results. Burndown uses end-of-day semantics: remaining = tasks created on or before that day minus tasks completed on or before that day.
- **ADR-4 (no new tables)**: All queries read `audit_logs`, `tasks`, `statuses`, `task_assignments`, `ai_usage_records`. Analytics module uses `TypeOrmModule.forFeature([])` and injects raw `DataSource`.
- **ADR-5 (Cache-Control via interceptor)**: `AnalyticsCacheInterceptor` uses `tap()` to set `Cache-Control: public, max-age=300, stale-while-revalidate=60` on every analytics response. Aligned with design §5.
- **ADR-6 (workspace-scope filtered by project memberships for non-ADMIN/OWNER)**: `DomainAnalyticsService` calls `ProjectMembershipService.findProjectIdsForUser` for MEMBER/GUEST roles. OWNER/ADMIN skip the filter and see all workspace data.
- **ADR-7 (WS subscription quota — canonical = 100)**: `WS_MAX_ROOMS_PER_SOCKET` default changed from 200 → 100 per design §7.1. Counter tracked in `socket.data.roomCount`. Over-quota subscribe throws `WsException('SUBSCRIPTION_QUOTA')`.
- **ADR-8 (Redis token-bucket backpressure — fall-open)**: `WsBackpressureMiddleware` uses `INCR + EXPIRE` pattern. Redis errors → fall open (allow). Sustained overrun (≥3 consecutive windows over limit) triggers socket disconnect.

### Key technical choices

- **11 query helpers** (7 domain + 4 AI): each is an `@Injectable()` class with a single `execute()` (or `executeWithMeta()` for StatusFlowQuery) method. Injected into services, not directly into controllers.
- **`RequestContextService` for workspaceId + userId + role**: both `DomainAnalyticsService` and `AiAnalyticsService` resolve tenant context via the existing `RequestContextService` abstraction.
- **`ProjectMembershipService.findProjectIdsForUser`**: new method added (R1 risk fix). Returns `string[]` of projectIds the user is a member of, filtered by workspace.
- **`StatusFlowQuery.executeWithMeta()`**: returns `{edges, isLimitHit}` instead of plain array. Controller sets `X-Analytics-Truncated: true` header when LIMIT 1000 is hit.
- **`WS_REDIS_TOKEN = Symbol('WS_REDIS_TOKEN')`**: `WsBackpressureMiddleware` uses `@Optional() @Inject(WS_REDIS_TOKEN)` — no new Redis module dependency. Raw `ioredis` injected directly.
- **DueSoonScheduler SQL DONE filter (S3)**: moved from in-memory `statusCategory === 'done'` post-filter to a `LEFT JOIN` + `andWhere('ts.category <> :done')` SQL clause. More efficient; test updated.
- **3 new CASL actions**: `read_workspace_analytics`, `read_project_analytics`, `read_ai_analytics_by_user`. Granted in `ability.factory.ts` per role.
- **Settings key**: `KNOWN_KEYS.workspace += 'analytics.default_period'` with default `'week'`.
- **Migration `1700000000700-Fase8AnalyticsIndexes`**: adds 2 partial indexes — `idx_audit_ws_action_time` (audit_logs) and `idx_project_memberships_user_workspace` (project_memberships). Both use `CREATE INDEX IF NOT EXISTS` for idempotency.

### Test counts

| Batch | Unit tests added | Running total |
|---|---|---|
| Phases A–M | +155 | 1,121 (baseline 966) |

### TODOs handed to next phases

- **Migration run**: `1700000000700-Fase8AnalyticsIndexes.ts` written and unit-tested but not executed against live DB. Run `npm run migration:run -w @jitre/backend`.
- **E2E specs (N1–N4)**: `analytics-velocity.e2e-spec.ts`, `analytics-burndown.e2e-spec.ts`, `analytics-ai-usage.e2e-spec.ts`, `analytics-rbac.e2e-spec.ts` written with `describe.skip` — require Docker (Postgres + Redis). Run: `POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend`.
- **AiController RequireAbility wiring**: CASL actions are defined and granted; `@RequireAbility` decorator application on AI controller endpoints is a one-liner deferred to a cleanup pass.
- **Backpressure middleware wiring**: `WsBackpressureMiddleware` implemented and tested. Wiring into `RealtimeGateway` is deferred — requires `WS_REDIS_TOKEN` provider registration in `RealtimeModule`.
- **Real email driver**: still a logged stub from Fase 3.
- **ElasticSearch engine**: stub from Fase 5. Interface frozen.
- **AiUsageListener 80% warning**: deferred from Fase 7. `@OnEvent('ai.request_made')` handler not yet implemented.
- **Streaming + embed AI endpoints**: `GeminiProvider.generateStream` and `.embed` implemented but not exposed via HTTP.
- **Anthropic + OpenAI providers**: stubs. Real implementations deferred.

---

## Fase 9 — Frontend Polish (Angular 21)

### Goal

Full Angular 21 frontend — standalone components, signals, OnPush, Vitest TDD. Covers auth, real-time store sync, command palette, keyboard shortcuts, optimistic updates, Chart.js analytics charts, all feature pages, and full routing wire-up.

### Architecture Decisions (D1–D15)

- **D1 (Signals over RxJS)**: All app state uses Angular signals + `computed()`. RxJS limited to HttpClient interceptors where Angular APIs require Observables. No NgRx/NGXS.
- **D2 (Standalone only)**: Every component, directive, and pipe is standalone. No `*.module.ts` files under `src/app/`. Angular v20+ default.
- **D3 (Chart.js v4)**: `chart.js@^4`, dynamically imported via `afterNextRender` into an analytics chunk. ~80KB gzipped vs ECharts ~250KB. Trade-off: no built-in zoom/brush — acceptable for Fase 9.
- **D4 (Simple markdown: textarea + marked pipe)**: `marked` + `DOMPurify` for task/comment preview. Rich editor (Tiptap, Lexical) deferred.
- **D5 (Toast top-right)**: Per-toast manual dismiss + auto-TTL. Doesn't obscure sidebar or workspace.
- **D6 (Native Reactive Forms)**: No Formly. Simple forms (login, register, settings). Bridge to signals via `toSignal()` where needed.
- **D7 (Realtime: refetch not merge)**: Fase 7 ADR-9 IDs-only payloads → `store.refetcher(id)` on every realtime event. Ensures permission re-check + cache coherence.
- **D8 (Optimistic: last-write-wins v1)**: `OptimisticUpdateService.run()` — no per-id mutex. `isPending(id)` skips realtime echo.
- **D9 (Auth tokens: memory + httpOnly cookie)**: Access token in `_accessToken` signal only. Refresh token in httpOnly cookie (set by backend). Cold-load: `hydrate()` via `provideAppInitializer`.
- **D10 (Command palette: Promise.allSettled)**: One failing provider doesn't break others. Logged via `console.warn`.
- **D11 (Virtual scroll: fixed-height v1)**: CDK `AutoSizeVirtualScrollStrategy` is experimental. Fase 9 rows have fixed heights.
- **D12 (Singleton stores)**: `providedIn: 'root'`. Workspace switch triggers `clear() + load()` via `AuthService` effect.
- **D13 (Skeleton loaders: per-section inline)**: Progressive content fill. `animate-pulse` from Tailwind design system.
- **D14 (Layout: top header + left sidebar)**: Header carries workspace switcher + cmd-k trigger. Sidebar carries navigation.
- **D15 (Input shortcut opt-out)**: Shortcut handler skipped in input fields unless allow-listed. `cmd+k` still works (modifier excluded from `isTypingInInput` check).

### Key technical choices

- **createEntityStore\<T\> factory**: Generic signal-based entity store. `load()`, `upsert()`, `remove()`, `byId()` (computed `Record<string,T>`), `applyEvent()`, `clear()`.
- **RealtimeService**: `vi.mock('socket.io-client')` in specs. Binds one listener per `RealtimeEvent` enum value; routes to `TaskStore/ProjectStore/NotificationStore.applyEvent()`.
- **KeyboardShortcutService**: Cross-platform (Cmd↔Ctrl), sequential shortcuts (`g→p` with 1.5s drain), input-field opt-out. `vi.useFakeTimers()` for timeout tests.
- **CommandPaletteService**: AbortController cancels in-flight on new query; `Promise.allSettled` per provider; recent items LRU (LocalStorage, max 10).
- **JwtInterceptor**: 401 → single refresh-then-retry; refresh failure → `auth.logout()`.
- **Chart.js**: `vi.mock('chart.js', () => ({ Chart: vi.fn(), registerables: [] }))` in all chart specs. `afterNextRender` used (not `afterRender` — Angular 21 exports `afterNextRender`/`afterEveryRender`). jsdom canvas warnings are expected and harmless.
- **App shell**: Root `App` component renders only `<router-outlet>`. `MainLayoutComponent` contains `ToastContainerComponent` + `CommandPaletteComponent`. Route tree is fully lazy (`loadComponent`).
- **E2E scaffolds**: `describe.skip` stubs under `packages/frontend/e2e/` — auth, command palette, task lifecycle, AI describe, analytics. No Playwright config yet (backend Docker harness unavailable).

### Test counts

| Phase | Tests | Running total |
|---|---|---|
| Batch 1 (A, R, B, C) | +68 | 70 |
| Batch 2 (D-deferred, E, F, G, H, I) | +78 | 148 |
| Batch 3 (J, K, L, M, N, O, P-partial) | +61 | 209 |
| Batch 4 (P-charts, Q, S, T) | +13 | 222 |

**Total new Vitest specs: 222 (baseline was 2).**

### TODOs handed to next phases

- **E2E specs**: 5 files under `packages/frontend/e2e/` with `describe.skip`. Un-skip when Playwright + backend Docker harness are available.
- **Playwright config**: not yet created. Add `playwright.config.ts` + install `@playwright/test` when E2E harness is ready.
- **ESLint**: frontend has no real ESLint config (stub `echo 'frontend lint stub'`). Add Angular ESLint config in a dedicated cleanup pass.
- **CDK virtual scroll for variable-height rows**: deferred (Fase 10+). Current implementation uses `@for` with fixed-height rows.
- **Streaming + embed AI**: backend `GeminiProvider.generateStream` + `.embed` implemented but not exposed — frontend AI components assume sync responses.
- **Real email driver**: still a logged stub from Fase 3.
- **NgOptimizedImage**: not yet applied to all static images (only directive + components importing it where needed).
- **AccessToken rotation on tab restore**: `hydrate()` covers cold boot. Multiple-tab session sync not addressed.
- **NotificationListComponent virtual scroll**: uses plain `@for` (CDK virtual scroll skipped to avoid jsdom incompatibility).
- **Settings panels**: `UserSettings`, `NotificationSettings`, `WorkspaceSettings`, `AiSettings` panels tested via `SettingsComponent` spec with `NO_ERRORS_SCHEMA` (behavior is mechanical HTTP wrappers).
- **`WorkspaceSettingsPanelComponent`**: uses `auth.currentWorkspace()` which may be `null` on cold load — guarded with `?? ''`.
- **AiController RequireAbility + Anthropic/OpenAI**: still deferred from Fase 7/8.
