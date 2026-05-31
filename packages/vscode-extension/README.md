# Jitre — VS Code extension

Browser de Jitre dentro del editor: proyectos, tareas, comentarios, time tracking, búsqueda, realtime, integración con git, AI subtasks, CodeLens. Pensada para que un dev pueda trabajar sin saltar al navegador.

> **Mirá también** `packages/mcp-server` para conectar Jitre como contexto a Claude / Cursor.

---

## Instalación rápida

Desde la raíz del repo:

```bash
npm run vscode:install
```

El script detecta qué editor tenés (VS Code, VS Code Insiders, VSCodium, Cursor), instala dependencias si hace falta, buildea, empaqueta el `.vsix` y lo instala.

¿Querés saltearte el prompt?

```bash
npm run vscode:install -- --editor=code        # o code-insiders, codium, cursor, all
npm run vscode:install -- --editor=code --force-rebuild
```

`npm run vscode:install -- --help` para ver todos los flags.

Después: abrí el editor → ícono **J** en la activity bar → **Sign in**.

---

## Primer uso (2 minutos)

1. **Levantá el backend** (en otra terminal):
   ```bash
   npm run docker:up && npm run dev:backend
   ```
   Si nunca corriste el seed, `npm run setup` primero.

2. **Click en el ícono J** → **Sign in**.
   URL del backend + tus credenciales reales.
   > Si estás probando el seed local: URL `http://localhost:3000` · email `admin@jitre.test` · pass `admin123`. **Estas son credenciales demo del seed local — NO existen en una instalación de producción.**

3. Vas a ver 4 vistas:
   - **Workspace** — vos, tu workspace, y la tarea activa si tu git branch matchea un key.
   - **Projects** — proyectos con tareas agrupadas por status, drag-and-drop entre statuses.
   - **My Tasks** — lo asignado a vos.
   - **Notifications** — las últimas 50.

---

## Las 5 cosas más útiles para devs

| Acción | Atajo |
|---|---|
| Buscar tarea por texto | `Ctrl+Alt+J K` |
| Abrir tarea por key (ej. `JIT-3`) | `Ctrl+Alt+J O` |
| Crear tarea desde código seleccionado | `Ctrl+Alt+J N` |
| Arrancar/parar timer | `Ctrl+Alt+J T` |
| Prefijar el commit SCM con la key de la branch | `Ctrl+Alt+J C` |

Si tu branch se llama `feat/JIT-123-foo`, la extensión la detecta y la muestra como **tarea activa** arriba de la sidebar.

---

## Tareas → git

`Jitre: Bind this folder to a project` ata el folder a un proyecto vía `.jitre/config.json`.

A partir de ahí:
- `Jitre: Create git branch from task` → elegís tarea + tipo (`feat/fix/chore/...`), te genera `feat/JIT-123-slug` y hace checkout.
- `Jitre: Prefix SCM commit with task key` (o `Ctrl+Alt+J C`) → prepende `[JIT-123]` al commit message del SCM activo.

---

## AI

Sobre cualquier tarea (click derecho):
- **Suggest subtasks with AI** → pide al `/ai` del backend, te muestra checkboxes, crea las elegidas como subtasks.
- **Regenerate description with AI** → reescribe la descripción con el tono que elijas.

---

## Configurar

`Settings → Extensions → Jitre` (o `Ctrl+,` + buscar "jitre"):

| Setting | Default | Para qué |
|---|---|---|
| `jitre.apiUrl` | `http://localhost:3000` | Backend. |
| `jitre.codeLens.enabled` | `true` | Lens "View task" arriba de líneas con `JIT-123`. |
| `jitre.openTasksInBrowser` | `false` | Click en tarea abre web app en vez del webview. |

Credenciales: en `SecretStorage` de VS Code. Sobreviven restart.

---

## Más detalle

Todo lo demás (lista completa de comandos, troubleshooting, estructura interna, realtime, attachments, etc): [`DETAILS.md`](./DETAILS.md).

---

## Desinstalar

```bash
code --uninstall-extension jitre.jitre-vscode
```

(o desde la pestaña Extensions en VS Code, buscar "Jitre" → Uninstall.)
