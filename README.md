# Jitre

AI-first project management platform — modern, minimalist, enterprise-ready.

## Workspaces

| Package | Path | Description |
|---------|------|-------------|
| `@jitre/shared` | `packages/shared` | DTOs, enums, interfaces shared across backend and frontend |
| `@jitre/backend` | `packages/backend` | NestJS 11 API |
| `@jitre/frontend` | `packages/frontend` | Angular 21 UI |

## Getting started

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migration:run
npm run dev:backend   # http://localhost:3000/api/v1/docs
npm run dev:frontend  # http://localhost:4200
```

## Phases

Build is split in 9 phases — see `CHANGELOG-PHASES.md` for each phase's scope, decisions, and TODOs.

## Stack

- **Monorepo:** npm workspaces
- **Backend:** NestJS 11 + TypeORM 0.3 + PostgreSQL 16 + Redis 7
- **Frontend:** Angular 21 + Tailwind 4 + Signals
- **AI:** Gemini 2.0 Flash (abstraction-ready for Anthropic/OpenAI)
- **Realtime:** Socket.IO
- **Jobs:** BullMQ

---

## Frontend Development

### Prerequisites

- Node.js 20+
- `npm install` from repo root (workspaces install all packages)

### Dev server

```bash
npm run dev:frontend
# or directly:
npm run start -w @jitre/frontend
```

Opens Angular at `http://localhost:4200`. The dev server proxies `/api/v1/...` to the backend on port 3000. Ensure `npm run dev:backend` is running.

### Testing

```bash
# Run all frontend Vitest unit tests (watch mode off):
npm run test -w @jitre/frontend

# Run backend Jest suite:
npm run test -w @jitre/backend
```

Frontend tests use **Vitest 4 + Angular TestBed** (jsdom environment). No Karma/Jasmine.

Test command runs `ng test` which invokes `@angular/build:unit-test` with Vitest under the hood.

### Building

```bash
npm run build -w @jitre/frontend
# Production build with stats:
npm run analyze -w @jitre/frontend
```

### Linting

```bash
npm run lint -w @jitre/frontend
# Note: frontend ESLint config is a stub (Fase 9). A real Angular ESLint config is a TODO.
```

### Frontend architecture (Fase 9)

```
packages/frontend/src/app/
  core/           — services: auth, http interceptors, realtime, keyboard, toast, ai, analytics
  stores/         — createEntityStore<T> factory + TaskStore/ProjectStore/NotificationStore
  shared/         — UI primitives: skeleton, toast-container, virtual-list, markdown pipe,
                    keyboard directives, command palette + providers
  layouts/        — MainLayoutComponent (authenticated shell), AuthLayoutComponent
  features/       — auth, dashboard, projects, tasks, settings, analytics, notifications
  app.routes.ts   — lazy routes with authGuard; full tree wired in Fase 9
  app.config.ts   — interceptors, command palette providers, app initializer
```

Key conventions:
- **Standalone components** — no NgModules anywhere
- **Signals** — all state via `signal()` + `computed()`; RxJS only in HTTP interceptors
- **OnPush** — all components use `ChangeDetectionStrategy.OnPush`
- **inject()** — no constructor injection
- **Reactive Forms** — no template-driven forms
- **Native control flow** — `@if`, `@for`, `@switch`; no `*ngIf/*ngFor`

### E2E (deferred)

Scaffold specs live under `packages/frontend/e2e/` (all `describe.skip`).
Un-skip when Playwright + backend Docker harness are available.

```bash
# Install Playwright when ready:
npm install -D @playwright/test -w @jitre/frontend
npx playwright install
```
