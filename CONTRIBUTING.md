# Contributing to Jitre

¡Gracias por interesarte en contribuir! Este documento explica cómo levantar el proyecto en local, qué convenciones seguimos y cómo proponer cambios.

---

## TL;DR

```bash
# Demo mode (cero deps locales — solo Docker)
npm run demo:up
# → http://localhost:8080 con admin@jitre.test / admin123

# Dev mode (para hackear el código)
npm install
npm run setup            # copia .env, docker up, migrate, seed
npm run dev:backend      # terminal 1
npm run dev:frontend     # terminal 2
```

---

## Setup local detallado

### Prerrequisitos

- **Node.js 20+** y **npm 10+**
- **Docker** y **Docker Compose** (para Postgres + Redis locales)
- **Git**

### Primer arranque

```bash
git clone https://github.com/YamilEzequiel/jitre.git
cd jitre
npm install              # instala los 3 workspaces (shared, backend, frontend)
cp env.example .env      # toca el .env si necesitás cambiar puertos / API keys
npm run setup            # docker up + esperar DB + migrate + seed
```

Después tenés dos opciones:

- **Dev:** `npm run dev:backend` + `npm run dev:frontend` en terminales separadas. Hot reload en ambos.
- **Demo all-in-one:** `docker compose -f compose.demo.yml up`. Levanta el stack productivo completo en un solo comando, con seed automática y la UI en `http://localhost:8080`.

### Credenciales del seed

Después de `npm run setup` te quedan estas cuentas listas:

| Email | Password | Rol |
|---|---|---|
| `admin@jitre.test` | `admin123` | Workspace Owner |
| `pm@jitre.test` | `pm123` | Workspace Admin |
| `dev1@jitre.test` | `dev123` | Member (tiene timer activo) |
| `dev2@jitre.test` | `dev123` | Member |

---

## Convenciones

### Code style

#### Frontend (Angular 21)

- **Standalone components** — sin NgModules.
- **Signals + `computed()`** — RxJS solo en interceptors HTTP.
- **OnPush en todo** — `ChangeDetectionStrategy.OnPush` no es opcional.
- **`inject()`** — nada de constructor injection.
- **Reactive Forms** — sin template-driven.
- **Control flow nativo** — `@if`, `@for`, `@switch` (sin `*ngIf`).
- **`class` bindings**, nunca `ngClass`. **`style` bindings**, nunca `ngStyle`.
- **Accesibilidad** — pasar AXE; cumplir WCAG AA en focus, contraste, ARIA.

#### Backend (NestJS 11)

- **Single Responsibility** por servicio.
- **`providedIn: 'root'`** para singletons; un módulo solo cuando hay scope real.
- **DTOs con `class-validator`** — nunca aceptes request body tipado a mano.
- **Migraciones versionadas** — generá con `npm run db:migration:generate -- <nombre>`. Nunca uses `DATABASE_SYNCHRONIZE=true`.
- **Events sobre cross-module imports** — preferí `EventEmitter2` antes que inyectar servicios entre dominios.

### Commits

- **Conventional Commits**: `feat(scope): ...`, `fix(scope): ...`, `chore(...)`, `docs(...)`, `refactor(...)`, etc.
- **Nada de "Co-Authored-By: AI"** ni atribución de modelos.
- **Mensajes en inglés**, descripción de POR QUÉ no de QUÉ.
- **Body opcional** pero recomendado cuando el cambio tiene tradeoffs.

```
feat(tasks): add prev/next navigation between project tasks

The detail view forced users back to the list to switch between
sibling tasks, breaking flow when triaging a backlog. Navigation pill
is computed from the task store; no extra round-trips.
```

### Pull Requests

1. **Abrí un issue primero** si el cambio es grande (feature, refactor amplio, módulo nuevo). Alineamos enfoque antes de invertir tiempo en código.
2. **PRs chicos y enfocados.** Idealmente <400 líneas changed. Si crece más, lo splitteamos.
3. **Tests pasando.** Si tocaste lógica, agregá tests. Si tocaste un componente sin tests, considerá agregar el primero.
4. **Comentá tu implementación en el PR**: decisiones, tradeoffs, qué descartaste. Facilita la review y deja history para quien venga después.

### Cambios de UX

La UX está pensada con un criterio específico (minimalista, AI-first, productividad).

- **No aceptamos PRs que cambien la UX a grandes rasgos** sin discusión previa: rediseños globales, restructuras de navegación, cambios de information architecture, sustitución del sistema de diseño.
- **Sí son bienvenidos sin discusión**: fixes de UI rotos, mejoras de accesibilidad, ajustes finos de copy/spacing, traducciones, micro-interacciones que no alteren el flow.

### Buenos primeros PRs

- Accesibilidad (ARIA, contraste, focus states).
- Traducciones (i18n) — actualmente `en` y `es`.
- Tests faltantes en módulos existentes.
- Documentación de endpoints en Swagger.
- Performance: memoizaciones, OnPush misses, queries N+1.
- Drivers de storage adicionales (S3, R2, MinIO ya existen como interface; podés agregar GCS / Azure).

---

## Tests

```bash
# Todos los workspaces
npm run test

# Backend solo (Jest)
npm run test -w @jitre/backend

# Frontend solo (Vitest 4 + Angular TestBed con jsdom)
npm run test -w @jitre/frontend

# E2E backend (Postgres real necesario)
npm run test:e2e:backend
```

Convenciones de testing:

- **Mockear el DB solo en tests unitarios.** Para tests de servicio que tocan transacciones / triggers, usar la DB real (E2E).
- **Snapshots solo para output estable.** No para JSX/HTML.
- **Tests describen comportamiento, no implementación.** `it('reasigna el task al cerrarse el blocker')`, no `it('llama a updateAssignee()')`.

---

## Reportar bugs

Abrí un issue con:

1. **Pasos para reproducir** — secuencia mínima.
2. **Comportamiento esperado** vs **observado**.
3. **Entorno**: SO, versión de Node, versión de Docker, branch / commit.
4. **Logs relevantes** del backend (`docker logs jitre-backend`) o consola del browser.

---

## Licencia y CLA

Jitre se distribuye bajo la [Elastic License 2.0](./LICENSE) y opera un modelo
de **dual-licensing**: ELv2 para el público + licencias comerciales negociadas
para casos de reventa / SaaS / white-label.

Para sostener ese modelo, **todo contribuidor debe firmar el [Contributor
License Agreement (CLA)](./CLA.md) una sola vez**. El CLA te otorga a vos los
créditos como autor original y al mantenedor los derechos necesarios para
incluir tu código tanto en la versión ELv2 como en licencias comerciales
futuras.

### Cómo funciona

1. Abrís un PR como siempre.
2. El bot **CLA-assistant** comenta automáticamente con el link al `CLA.md` y
   la frase a copiar.
3. Respondés en el PR: *"I have read the CLA Document and I hereby sign the CLA"*.
4. El bot registra tu firma. Listo — todos tus PRs futuros quedan cubiertos.

No hace falta firmar nada físicamente ni enviar mail. La firma queda asociada a
tu cuenta de GitHub.

Si tenés dudas sobre el CLA antes de firmar, abrí un issue o contactame por
[LinkedIn](https://www.linkedin.com/in/yamil-lazzari/).

---

## Contacto

- **Issues**: <https://github.com/YamilEzequiel/jitre/issues>
- **LinkedIn**: [linkedin.com/in/yamil-lazzari](https://www.linkedin.com/in/yamil-lazzari/)
