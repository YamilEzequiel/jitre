# Jitre MCP server

[MCP](https://modelcontextprotocol.io) server que expone Jitre a Claude / Cursor / cualquier cliente MCP. Tu LLM puede listar proyectos, tareas, comentarios, crear/actualizar tasks, buscar, comentar — solo.

---

## Instalación rápida

Desde la raíz del repo:

```bash
npm run mcp:setup
```

Te va a preguntar 3 cosas: URL del backend, email/password, y dónde registrarlo (Claude Code / Desktop / Cursor / "solo mostrame el JSON"). El script buildea si hace falta, calcula el path absoluto a tu clon, y deja todo wirado.

¿Querés automatizar sin prompts? Pasale flags:

```bash
npm run mcp:setup -- --client=claude-code --email=tu-email@empresa.com --password='...'
```

`npm run mcp:setup -- --help` para ver todos los flags.

> **Aviso de seguridad**: el password que pongas queda en la config del cliente MCP en **texto plano** (`~/.claude.json`, `claude_desktop_config.json`, `~/.cursor/mcp.json`). Es una limitación del protocolo MCP. Para reducir blast radius, generá un access token con TTL controlado y usá `--token=...` en vez de password.

---

## ¿Para qué sirve?

| Caso | Qué hace el LLM solo |
|---|---|
| Daily standup | Lee tus tareas y resume "ayer / hoy / bloqueos". |
| Crear tarea desde una charla | `jitre_create_task` con el contexto que ya tiene. |
| Trabajar `JIT-456` | Lee la tarea, comenta progreso, mueve el status. |
| "¿qué hago ahora?" | Lista tus tareas priorizadas. |

> Si querés más detalle de cuándo conviene y la lista entera de tools, mirá [`DETAILS.md`](./DETAILS.md).

---

## Probar que funciona

Con el backend corriendo:

```bash
# Una vez registrado, en cualquier sesión de Claude/Cursor:
> listame mis tareas de Jitre
```

Si no respondiera, mirá [Troubleshooting](#troubleshooting).

---

## Tools (15)

`jitre_whoami` · `jitre_list_workspaces` · `jitre_list_projects` · `jitre_get_project` · `jitre_list_project_statuses` · `jitre_list_tasks` · `jitre_get_task` · `jitre_create_task` · `jitre_update_task` · `jitre_change_task_status` · `jitre_complete_task` · `jitre_assign_task` · `jitre_list_comments` · `jitre_add_comment` · `jitre_search`

---

## Configurar credenciales

`mcp:setup` ya pregunta esto, pero si necesitás editar la config a mano, las variables que el server lee son:

| Var | Default | Notas |
|---|---|---|
| `JITRE_API_URL` | `http://localhost:3000` | Backend (sin slash final). |
| `JITRE_API_VERSION` | `1` | |
| `JITRE_EMAIL` + `JITRE_PASSWORD` | — | Lo más simple. |
| `JITRE_ACCESS_TOKEN` | — | Bypass del login si ya tenés un token vivo. |
| `JITRE_REFRESH_COOKIE` + `JITRE_CSRF_COOKIE` | — | Bypass con cookies de refresh. |

---

## Troubleshooting

| Síntoma | Causa | Solución |
|---|---|---|
| `Error: No Jitre credentials` | Env vars no llegan al server. | Re-corré `npm run mcp:setup` con flags explícitos. |
| `Error: 401` | Credenciales inválidas. | Probá `curl POST <JITRE_API_URL>/api/v1/auth/login` con las mismas. |
| `Error: fetch failed` | Backend off o URL mal. | Levantá el backend (`npm run dev:backend`). |
| `claude mcp add` falla | Claude Code no está en PATH. | Instalalo, o elegí "Solo mostrame el JSON" y pegalo a mano. |
| Tool calls timeout | Build viejo o ausente. | `cd packages/mcp-server && npm run build`. |

---

## Build manual

Solo si querés saltearte el script:

```bash
cd packages/mcp-server
npm install
npm run build
# El binario queda en packages/mcp-server/dist/index.js
```
