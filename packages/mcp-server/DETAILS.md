# Jitre MCP — detalles

> Solo si te interesa cómo está hecho. Para usarlo, mirá [`README.md`](./README.md).

## Cómo funciona

1. Cliente MCP (Claude / Cursor) lanza `node dist/index.js` con env vars.
2. Server arranca un transport stdio MCP `2024-11-05`.
3. En la primera tool-call, hace login HTTP contra el backend (`POST /api/v1/auth/login`) si no tiene token.
4. Cachea access token + refresh cookie + csrf cookie en memoria.
5. Cada tool-call llama un endpoint REST con `Authorization: Bearer …` + `x-workspace-id`.
6. Si recibe `401`, intenta `POST /api/v1/auth/refresh` una vez y reintenta.

Es el mismo wire-protocol que la extensión de VS Code, pero standalone — no comparten código para que el server se pueda distribuir solo.

## Lista completa de tools

| Tool | Descripción | Input requerido |
|---|---|---|
| `jitre_whoami` | User + workspace activo. | — |
| `jitre_list_workspaces` | Workspaces del user. | — |
| `jitre_list_projects` | Proyectos del workspace. | — |
| `jitre_get_project` | Detalle de un proyecto. | `projectId` |
| `jitre_list_project_statuses` | Statuses del proyecto. | `projectId` |
| `jitre_list_tasks` | Tasks. Filtros opcionales. | `projectId` |
| `jitre_get_task` | Detalle de una task. | `taskId` |
| `jitre_create_task` | Crea task (con `parentTaskId` = subtask). | `projectId`, `title` |
| `jitre_update_task` | Patch parcial. | `projectId`, `taskId` |
| `jitre_change_task_status` | Mueve a otro status. | `projectId`, `taskId`, `statusId` |
| `jitre_complete_task` | Mark as done. | `projectId`, `taskId` |
| `jitre_assign_task` | Asigna un user. | `projectId`, `taskId`, `userId` |
| `jitre_list_comments` | Comentarios de una task. | `taskId` |
| `jitre_add_comment` | Postear comentario. | `taskId`, `body` |
| `jitre_search` | Full-text search workspace-wide. | `q` |

## Registrar a mano (sin el script)

Si por alguna razón `npm run mcp:setup` no te sirve, podés registrar el server a mano. Sacá el path absoluto de `dist/index.js`:

```powershell
# Windows
Resolve-Path .\packages\mcp-server\dist\index.js
```

```bash
# macOS / Linux
realpath packages/mcp-server/dist/index.js
```

A ese string lo llamamos `<DIST_PATH>` abajo.

### Claude Code (CLI)

```bash
claude mcp add jitre node "<DIST_PATH>" \
  -e JITRE_API_URL=http://localhost:3000 \
  -e JITRE_EMAIL=tu-email@example.com \
  -e JITRE_PASSWORD=tu-password
```

### Claude Desktop

| OS | Ruta del config |
|---|---|
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "jitre": {
      "command": "node",
      "args": ["<DIST_PATH>"],
      "env": {
        "JITRE_API_URL": "http://localhost:3000",
        "JITRE_EMAIL": "tu-email@example.com",
        "JITRE_PASSWORD": "tu-password"
      }
    }
  }
}
```

Reiniciás la app.

### Cursor

Editás `~/.cursor/mcp.json` con la misma estructura que Claude Desktop.

### Cualquier otro cliente MCP

El server habla stdio. Cualquier cliente que sepa lanzar un proceso con env vars funciona:

```bash
node <DIST_PATH>
```

## Probar el server por fuera de cualquier cliente

Con el backend corriendo, desde `packages/mcp-server`:

```powershell
# Windows PowerShell
$env:JITRE_API_URL = 'http://localhost:3000'
$env:JITRE_EMAIL = 'admin@jitre.test'
$env:JITRE_PASSWORD = 'admin123'
@(
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'
  '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"jitre_whoami","arguments":{}}}'
) -join "`n" | node dist/index.js
```

```bash
# macOS / Linux
JITRE_API_URL=http://localhost:3000 \
JITRE_EMAIL=admin@jitre.test \
JITRE_PASSWORD=admin123 \
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"jitre_whoami","arguments":{}}}' \
  | node dist/index.js
```

La respuesta a `id:2` trae tu user + workspace si todo está bien.

## Ejemplos de prompts

- "Listame las tareas asignadas a mí ordenadas por prioridad."
- "Creá una tarea en el proyecto JIT con título 'Fix login bug'."
- "¿Qué se discutió en los comentarios de JIT-3?"
- "Marcá JIT-5 como done y dejá un comentario con el resumen del fix."
- "Buscá tareas que mencionen 'webhook'."

## Limitaciones

- Sin streaming de eventos (no WebSocket). Para realtime, la extensión de VS Code.
- Sin attachments — multipart por MCP es engorroso, usar la extensión.
- AI tools del backend no expuestas como tools del MCP — el LLM cliente ya cumple ese rol.
- Una sesión, un workspace. Para cambiar, reiniciás con otro env.
