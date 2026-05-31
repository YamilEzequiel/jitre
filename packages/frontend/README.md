# `@jitre/frontend`

Angular 21 SPA — la UI principal de Jitre. Standalone components, Signals + OnPush en todo, Tailwind 4, Vitest 4.

> Si solo querés **consumir** Jitre desde tu workflow de dev (ver/crear/comentar tareas sin abrir el navegador), saltá a [Alternativas: extensión + MCP](#alternativas-extensión-de-vs-code--mcp-server) más abajo — quizás no necesitás el front en absoluto.

---

## Levantarlo en dev

Desde la raíz del monorepo (no desde acá adentro):

```bash
npm install
npm run dev:backend       # en una terminal — :3000
npm run dev:frontend      # en otra terminal — :4200
```

El dev server proxea automáticamente `/api/v1/*` al backend en `:3000` (ver `proxy.conf.json`). Abrí <http://localhost:4200> y entrá con las credenciales del seed (`admin@jitre.test` / `admin123`).

> Si querés correr Angular CLI directo desde este folder (`ng serve`, `ng test`, etc.), está OK pero tenés que setear el proxy manualmente o el front no encuentra el backend. Conviene ir por el script del monorepo.

---

## Convenciones (no negociables)

| Regla | Por qué |
|---|---|
| **Standalone components** — sin NgModules. | Angular 20+ los marca como default; pelearlos genera deuda. |
| **Signals + `computed()`** para estado local y derivado. RxJS solo en interceptors. | Menos overhead mental + dev-tools mejor + change-detection más predecible. |
| **`ChangeDetectionStrategy.OnPush`** en todo componente. | Bench measurable: ~40% menos ticks con la app grande. |
| **`inject()`** — no constructor injection. | Permite composición funcional en helpers/guards/resolvers. |
| **Reactive Forms** — no template-driven. | Type-safety + validación testeable. |
| **Control flow nativo** (`@if`, `@for`, `@switch`) — no `*ngIf`. | Es lo que Angular 17+ recomienda; mejor tree-shaking. |
| **`class` / `style` bindings** — no `ngClass` / `ngStyle`. | Más expresivo y type-safe. |
| **`NgOptimizedImage`** para imágenes estáticas. | LCP / CWV. |

Accesibilidad: tiene que pasar AXE y WCAG AA — focus management, contraste, ARIA donde corresponda.

---

## Estructura

```
src/app/
├── core/         servicios singleton: auth, http interceptors, realtime,
│                 keyboard, toast, ai, analytics, observability
├── stores/       factoría createEntityStore<T> + TaskStore /
│                 ProjectStore / CustomerStore / NotificationStore
├── shared/       UI primitives: skeleton, toast, virtual-list,
│                 markdown pipe, command palette
├── layouts/      MainLayoutComponent (auth shell), AuthLayoutComponent
├── features/     auth, dashboard, projects, tasks, settings, analytics,
│                 notifications, customers, areas, automations, chat,
│                 docs, employees, time-tracking, tickets, workflow
├── app.routes.ts rutas lazy con authGuard
└── app.config.ts interceptors, providers, app initializer
```

Los interceptors core hacen el contrato HTTP con el backend: `jwtInterceptor` agrega `Authorization: Bearer`, `workspaceInterceptor` agrega `x-workspace-id`, `csrfInterceptor` agrega `x-csrf-token` desde la cookie, y los errores se canalizan por un `errorInterceptor` único.

---

## Build & tests

```bash
npm run build              # producción (AOT, optimizado)
npm run watch              # build dev en watch
npm run test               # Vitest 4 + Angular TestBed (jsdom)
npm run lint               # stub — no hay linter dedicated en este paquete todavía
```

---

## Alternativas: extensión de VS Code + MCP server

El front no es el único punto de entrada al producto. El monorepo trae dos piezas **pensadas para developers** que evitan abrir el navegador:

### `packages/vscode-extension` — la app en tu editor

Activity-bar de VS Code con cuatro vistas: Workspace, Projects, My Tasks, Notifications. Webview de detalle de tarea, drag-and-drop entre statuses, timer en status bar, realtime via Socket.IO, integración con git (`feat/JIT-123-foo` detecta la tarea activa), CodeLens en cualquier `KEY-123` que aparezca en el código.

Instalación: desde la raíz del repo, `npm run vscode:install`. Detalle completo en [`packages/vscode-extension/README.md`](../vscode-extension/README.md).

### `packages/mcp-server` — Jitre como contexto para Claude / Cursor

Servidor MCP que expone 15 tools (`jitre_list_tasks`, `jitre_create_task`, `jitre_add_comment`, …) sobre stdio. Una vez registrado, tu LLM puede leer y mutar Jitre por su cuenta:

> "Listame mis tareas pendientes ordenadas por prioridad."
> Claude llama `jitre_whoami` → `jitre_list_tasks` (filtrado a tu userId) → te resume.

> "Marcá JIT-5 como done y dejá un comentario con el resumen del fix."
> Claude llama `jitre_add_comment` + `jitre_complete_task` en una sola tirada.

Instalación: `npm run mcp:setup` (registra en Claude Code / Desktop / Cursor). Detalle en [`packages/mcp-server/README.md`](../mcp-server/README.md).

### Cuándo usar qué

| Si querés… | Usá |
|---|---|
| Una UI completa con todas las vistas (board, planning, docs, chat, analytics) | **El frontend Angular** (este paquete). |
| Ver/crear/comentar tareas rápido sin salir del editor | **La extensión de VS Code**. |
| Que Claude/Cursor lean y muten Jitre como contexto en sus prompts | **El MCP server**. |

Las tres alternativas hablan con el mismo backend NestJS (`/api/v1`). Pueden coexistir sin problema — el dev tiene la UI cuando la necesita, la extensión para tareas atómicas, y el MCP para flujos LLM-driven.
