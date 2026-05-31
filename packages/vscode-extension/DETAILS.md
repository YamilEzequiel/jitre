# Jitre VS Code extension — detalles

> Para instalar y arrancar, mirá [`README.md`](./README.md). Esto es la referencia completa: cada vista, cada comando, troubleshooting, estructura interna.

---

## Instalación manual (si no querés usar el script)

```bash
cd packages/vscode-extension
npm install
npm run build
npm run package
code --install-extension jitre-vscode-0.1.0.vsix --force
```

> Si `code` no está en tu PATH: en VS Code, paleta (`Ctrl+Shift+P`) → "Shell Command: Install 'code' command in PATH".

## Modo desarrollo (Extension Host)

```bash
cd packages/vscode-extension
npm install
npm run watch
```

Abrí esa carpeta en VS Code y `F5` para lanzar el Extension Host con la extensión cargada en watch.

---

## Configurar

`Settings → Extensions → Jitre` (o `Ctrl+,` y buscás "jitre"):

| Setting | Default | Para qué |
|---|---|---|
| `jitre.apiUrl` | `http://localhost:3000` | Backend host (sin slash final). |
| `jitre.apiVersion` | `1` | Versión del API. |
| `jitre.webBaseUrl` | _vacío_ | URL del front para "Open in browser". Por default usa `apiUrl`. |
| `jitre.openTasksInBrowser` | `false` | Click en tarea abre web app en vez del webview interno. |
| `jitre.codeLens.enabled` | `true` | Inline lens "View task" arriba de líneas con `JIT-123`. |

Credenciales: van en `SecretStorage` de VS Code. Access token en memoria, `refresh_token` + `csrf_token` cifrados en el secret store — la sesión sobrevive un restart.

---

## Levantar el backend

Desde la raíz:

```bash
npm run docker:up       # Postgres + Redis
npm run dev:backend     # http://localhost:3000
```

Demo seed (`npm run setup` una vez):

| Email | Password |
|---|---|
| `admin@jitre.test` | `admin123` |
| `dev1@jitre.test` | `dev123` |

---

## Vistas y status bar

### Sidebar (activity bar — ícono J)

- **Workspace** — workspace activo, tu usuario, proyecto bindeado a este folder, **tarea activa** (si la branch matchea un key tipo `JIT-123`).
- **Projects** — todos los proyectos con sus tareas agrupadas por status. Soporta **drag-and-drop** entre statuses, filtro local de texto.
- **My Tasks** — todo lo asignado a vos, con filtros (status, prioridad, due date).
- **Notifications** — últimas 50 + mark-all-read.

### Status bar (inferior izquierda)

- `🚀 <Workspace>` — workspace activo. Click → switch.
- `⌚ Start timer` / `⏺ HH:MM:SS` — timer corriendo en tiempo real. Click → toggle.
- `🔔 N` — notificaciones no leídas, polling cada 60s.
- `📡 Jitre live` — estado del canal realtime (Socket.IO).

---

## Workflow git ↔ task (lo más importante)

### Atar este repo a un proyecto

`Jitre: Bind this folder to a project` (o click en "Folder not bound" en la vista Workspace).

Eso crea `.jitre/config.json`:

```json
{
  "workspaceId": "uuid",
  "projectId": "uuid",
  "projectKey": "JIT",
  "projectName": "Jitre"
}
```

A partir de ahí, "Create task" / "Create branch" defaultean a ese proyecto sin preguntar.

### Crear branch desde tarea

`Jitre: Create git branch from task` (o click derecho en una tarea):

1. Elegís la tarea.
2. Elegís el tipo: `feat / fix / chore / docs / refactor / test`.
3. El branch se llama `<kind>/<key>-<slug>`, p.ej. `feat/JIT-123-add-foo-bar`.
4. Checkout automático.

### Prefijar el commit con la task key

Estando en una branch tipo `feat/JIT-123-foo`:

`Jitre: Prefix SCM commit with task key` (o `Ctrl+Alt+J C`).

Eso pone `[JIT-123] <lo-que-haya-escrito>` en el input de SCM. Después tirás commit normal con Ctrl+Enter.

### Tarea activa

Si la branch actual contiene un key (`JIT-123`), la vista Workspace muestra **Active task: JIT-123 — Implementar X**. Click → abre el webview.

### Crear tarea desde código

Seleccionás código en el editor → click derecho → **Jitre: Create task from selection** (o `Ctrl+Alt+J N`):

- Title pre-rellenado con la primera línea de la selección.
- Descripción auto-formada: `From file:line` + bloque de código en markdown.

---

## CodeLens

Cualquier vez que mencionás un key tipo `JIT-123` en un archivo (comentario, README, commit msg, .md), aparece arriba un lens:

```
$(target) JIT-123 — Implementar feature foo
```

Click → abre el webview. Para apagarlo: `jitre.codeLens.enabled: false`.

---

## Operar tareas

Click en cualquier task:

- **Click izquierdo** → abre el webview de detalle.
- **Click derecho** → menú contextual completo: cambiar status, prioridad, asignar, completar, comentar, timer, branch, copy key/url, AI subtasks, AI describe.

Dentro del webview:

- Cambiar status (dropdown).
- Cambiar prioridad.
- Mark done.
- Postear comentario.
- Refrescar.
- Abrir en browser.

### Drag-and-drop entre statuses

En la vista Projects, arrastrás una task de un grupo de status a otro y se actualiza solo. Soporta selección múltiple.

### Filter en Projects view

`Jitre: Filter projects view` (o botón filter en el toolbar) → ingresás texto → filtra tasks por título / key / descripción.

### Filter en My Tasks

`Jitre: Filter My Tasks` → te pregunta categoría → prioridades → due date. Settings persisten globales.

---

## Time tracking

- `Jitre: Start timer on task` (o `Ctrl+Alt+J T`).
- Click en `⌚` del status bar para arrancar/parar.
- Auto-stopea cualquier timer previo (sólo uno corriendo a la vez).

---

## Búsqueda

`Ctrl+Alt+J K` → full-text search workspace-wide → quick pick de resultados ranqueados → enter abre el detalle.

`Ctrl+Alt+J O` → "Open task by key or ID" → tipeás `JIT-123` o el UUID, abre directo.

---

## AI

Sobre cualquier task (click derecho):

- **Jitre: Suggest subtasks with AI** → llama a `/ai/tasks/:id/suggest-subtasks`, muestra quick pick con checkboxes, crea las elegidas como subtasks (con `parentTaskId`).
- **Jitre: Regenerate description with AI** → llama a `/ai/tasks/:id/describe` (tono technical o casual), regenera y aplica.

---

## Attachments

Click derecho en cualquier archivo del Explorer → **Jitre: Attach file to task** → elegís la task → upload (multipart). MIME guesseado por extensión.

También por command palette: te pide el archivo + la task.

---

## Realtime (Socket.IO)

Apenas hay sesión, la extensión conecta al gateway `/ws` del backend con tu access token y se suscribe a:

- `task.{created,updated,status_changed,assigned,unassigned,completed,deleted,reordered}` → refresca Projects + My Tasks + Active task.
- `project.{created,updated,archived,member.added,member.removed}` → refresca Projects.
- `comment.{created,updated,deleted}` → reservado para el panel de detalle.
- `notification.created` → refresca Notifications y el badge `🔔 N`.

El status bar `📡 Jitre live` indica el estado: conectando · conectado · reconectando · offline · error.

---

## Atajos de teclado (defaults)

| Atajo | Acción |
|---|---|
| `Ctrl+Alt+J K` | Search tasks |
| `Ctrl+Alt+J O` | Open task by key/ID |
| `Ctrl+Alt+J T` | Toggle timer |
| `Ctrl+Alt+J N` | Create task from selection (editor) |
| `Ctrl+Alt+J C` | Prefix SCM commit with task key |

Customizá en `File → Preferences → Keyboard Shortcuts`.

---

## Lista completa de comandos

Filtrá por "Jitre:" en la paleta. Resumen:

| Categoría | Comandos |
|---|---|
| Auth | Sign in, Sign out, Configure server URL |
| Workspace | Switch workspace, Bind/Unbind folder to project |
| Tareas | Open task, Open in browser, Open task by key/ID, Create task, Create task from selection, Change status, Change priority, Assign, Mark as done, Add comment, Copy key, Copy URL |
| Filtros | Filter My Tasks, Clear filters, Filter projects view, Clear projects filter |
| Git | Create git branch from task, Prefix SCM commit with task key |
| Timer | Start timer, Stop timer, Toggle timer |
| Búsqueda | Search tasks |
| AI | Suggest subtasks with AI, Regenerate description with AI |
| Attachments | Attach file to task |
| Notificaciones | Open notifications, Mark all as read |
| Sistema | Refresh |

---

## Troubleshooting

| Síntoma | Probable causa | Qué hacer |
|---|---|---|
| "Sign-in failed: fetch failed" | Backend off o URL mal. | Levantá el backend, revisá `jitre.apiUrl`. |
| Login OK pero todo 401 | Token revocado. | Logout → login. |
| `📡 Jitre live · error` | WS auth o gateway down. | Logout → login. Revisá que el backend acepte WS en `/ws`. |
| `Create branch from task` falla | No hay git repo en el folder. | Inicializá git o abrí un folder con `.git`. |
| CodeLens no aparece | Setting `jitre.codeLens.enabled` en false, o el key no matchea `^[A-Z]{2,10}-\d+$`. | Revisá settings y el formato del key. |
| Filter no devuelve nada | El filtro suma — limpiá con "Clear filters". | — |

---

## Build & desarrollo

```bash
npm install
npm run lint            # tsc --noEmit
npm run build           # tsc → out/
npm run watch           # tsc -w
npm run package         # genera .vsix
```

### Estructura

```
src/
├── extension.ts                    # entry — registra todo
├── api/
│   ├── client.ts                   # HTTP + cookie jar + auto-refresh
│   └── types.ts                    # tipos de la API
├── state/
│   ├── session.ts                  # contexto "signed in"
│   ├── workspace-binding.ts        # .jitre/config.json
│   ├── filters.ts                  # filtros My Tasks
│   └── notifications-status.ts     # polling de notificaciones
├── tree/
│   ├── projects.ts                 # ProjectsTree + drag-and-drop
│   ├── my-tasks.ts                 # MyTasks con filtros
│   ├── workspaces.ts               # Workspace + Active task
│   └── notifications.ts
├── commands/
│   ├── auth.ts
│   ├── tasks.ts
│   ├── workspace.ts
│   ├── git-workflow.ts             # branch + commit prefix + create from selection
│   ├── timer.ts
│   ├── search.ts
│   ├── filters.ts
│   ├── clipboard.ts                # copy key/url, open by key
│   ├── ai.ts                       # suggest subtasks + describe
│   └── attach.ts                   # upload attachment
├── codelens/
│   └── task-refs.ts                # KEY-123 → CodeLens
├── realtime/
│   └── socket.ts                   # Socket.IO client
├── util/
│   └── git.ts                      # vscode.git API + parse key
└── webview/
    └── task-panel.ts               # webview de detalle
```

---

## Roadmap

- Cross-project drag-and-drop (hoy bloqueado porque la API no expone "move task to project").
- Switch real de workspace que mintee access token nuevo (hoy es local-only).
- Labels y custom fields editables desde el webview.
- Telemetría opt-in (rendimiento del realtime, fallas de auth).
