# AGENTS.md

Estás corriendo dentro del repo de **Jitre** — una plataforma de gestión de proyectos AI-first. Este documento es para vos, agente IA (Claude Code, Cursor, Aider, Copilot CLI, Codex, etc.). Los humanos leen el `README.md`; vos arrancá por acá.

## Qué incluye este repo

Monorepo (`@jitre/monorepo`) con cinco workspaces:

| Workspace | Stack | Para qué |
|---|---|---|
| `packages/shared` | TypeScript types | Contratos compartidos backend ↔ frontend |
| `packages/backend` | NestJS 11 + TypeORM + Postgres + Redis | API REST + WebSocket gateway |
| `packages/frontend` | Angular 21 + Tailwind 4 | Web app |
| `packages/mcp-server` | `@modelcontextprotocol/sdk` (stdio) | Expone Jitre como tools para LLMs |
| `packages/vscode-extension` | VS Code Extension API | Ver/crear tareas, timer, git workflow |

## Si el usuario te pide "instalá el MCP y la extensión"

Asumí Node **20+**. Si no, decile que actualice antes.

### Paso 1 — pedir los datos que faltan

Necesitás 4 cosas. Si no te las dio en su mensaje, preguntale **antes** de correr nada:

1. **API URL** del backend Jitre (ej. `http://localhost:3000` o `https://jitre.miempresa.com`).
2. **Email + password** del usuario, o un **access token**.
3. **Cliente MCP** a configurar: `claude-code`, `desktop`, `cursor`, `all`, o `print` (dry-run).
4. **Editor** para la extensión: `code` (VS Code), `cursor`, `windsurf`, `code-insiders`.

### Paso 2 — registrar el MCP server

```bash
npm install        # solo si no se corrió antes
npm run mcp:setup -- --client=<CLIENT> --api=<API> --email=<EMAIL> --password=<PWD>
```

Si el usuario te dio token en vez de password, reemplazá `--email/--password` por `--token=<TOKEN>`.

El script:
1. Buildea `packages/mcp-server` si no hay `dist/`.
2. Resuelve la ruta absoluta de `dist/index.js`.
3. Escribe el config del cliente MCP elegido (Claude Code via `claude mcp add`; Desktop/Cursor editando el JSON).

### Paso 3 — instalar la extensión

```bash
npm run vscode:install -- --editor=<EDITOR>
```

Detecta el binario CLI del editor (`code`, `cursor`, etc.), compila el `.vsix`, lo instala. Si el CLI no está en PATH, mostrale al usuario el error literal y sugerile correr el modo interactivo sin flags.

### Paso 4 — verificar

Después de los dos comandos:

- Decile al usuario que **reinicie el cliente MCP** (Claude Desktop / Cursor) para que aparezcan las tools. Claude Code agarra el server al toque en la próxima sesión.
- Decile que abra VS Code → ícono **J** en la activity bar → **Sign in** con el mismo email/password.
- Para validar el MCP: pedile a Claude algo como *"listame mis tareas pendientes en Jitre"*. Debería llamar `jitre_whoami` → `jitre_list_projects` → `jitre_list_tasks`.

## Comandos útiles del monorepo

| Comando | Qué hace | Cuándo |
|---|---|---|
| `npm install` | Instala deps de los 5 workspaces | Primera vez |
| `npm run mcp:setup` | Registra el MCP server | Dev (cada máquina) |
| `npm run vscode:install` | Compila e instala la extensión | Dev (cada máquina) |
| `npm run build` | Build de los 5 packages | Antes de deployar |
| `npm run setup` | Postgres + Redis + migraciones + seed | **Admin only** (requiere Docker) |
| `npm run docker:up` / `docker:down` | Stack completo en Docker | Admin |
| `npm run demo:up` | Stack con data demo precargada | Admin |

## Flags y modo no interactivo

Ambos scripts soportan `--help`:

```bash
node scripts/setup-mcp.mjs --help
node scripts/install-vscode-extension.mjs --help
```

Pasale todos los flags juntos para skipear los prompts. Si solo te falta uno, el script entra en interactivo solo para ese.

## Si algo falla

1. **Cliente MCP no aparece después del setup**: el cliente necesita reiniciarse. Avisale al usuario.
2. **`jitre_create_task` devuelve HTTP 400**: el backend requiere `statusId`. El MCP server ya lo resuelve automáticamente al status default del proyecto (`isDefault: true`), pero el `dist/` podría estar viejo. Corré `npm --workspace jitre-mcp-server run build` y reiniciá el cliente MCP.
3. **`vscode:install` no encuentra el CLI**: sugerí abrir el editor → Command Palette → *"Shell Command: Install 'code' command in PATH"*.
4. **`mcp:setup` falla con `claude mcp add`**: el usuario no tiene Claude Code instalado o no está en PATH. Caelé a `--client=desktop` o `--client=cursor`.
5. **`Cannot find module '@jitre/shared'` corriendo migrations, seed o dev:backend**: falta buildear `packages/shared/dist/`. `npm install` lo hace automáticamente via `postinstall`, pero si alguien lo skipeó o el dist quedó stale, corré `npm run build:shared` desde el root.

## NO hagas esto

- ❌ **No corras `npm run setup`** salvo que el usuario sea el admin del backend. Toca Docker, postgres y seed.
- ❌ **No commits los archivos generados** por el setup (los configs de Claude/Cursor viven fuera del repo).
- ❌ **No expongas el token, password ni cookies** del usuario en logs, commits, PRs o resúmenes.
- ❌ **No edites `packages/mcp-server/dist/`** a mano — es output de `tsc`.

## Para profundizar

- **READMEs específicos**: [`packages/mcp-server/README.md`](./packages/mcp-server/README.md), [`packages/vscode-extension/README.md`](./packages/vscode-extension/README.md).
- **Tools expuestas por el MCP**: ver `packages/mcp-server/src/index.ts` (array `TOOLS`).
- **Comandos de la extensión**: ver `packages/vscode-extension/package.json` → `contributes.commands`.
- **Endpoints del backend**: ver controladores en `packages/backend/src/**/controllers/`.
