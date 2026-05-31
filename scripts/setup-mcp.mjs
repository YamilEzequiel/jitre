#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Jitre MCP — one-shot installer.
 *
 *   npm run mcp:setup                  → modo interactivo
 *   npm run mcp:setup -- --client=...  → modo no-interactivo (ver --help)
 *
 * Detecta el OS, calcula la ruta absoluta a packages/mcp-server/dist/index.js
 * (build si hace falta) y registra el server en el cliente MCP que elijas.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { homedir, platform } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const MCP_DIR = resolve(REPO_ROOT, 'packages/mcp-server');
const DIST_PATH = resolve(MCP_DIR, 'dist/index.js');

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log = (msg = '') => process.stdout.write(`${msg}\n`);
const ok = (msg) => log(`${ANSI.green}✓${ANSI.reset} ${msg}`);
const info = (msg) => log(`${ANSI.cyan}•${ANSI.reset} ${msg}`);
const warn = (msg) => log(`${ANSI.yellow}!${ANSI.reset} ${msg}`);
const err = (msg) => process.stderr.write(`${ANSI.red}✗${ANSI.reset} ${msg}\n`);
const banner = () => {
  log('');
  log(`${ANSI.bold}${ANSI.cyan}╭─────────────────────────────────────╮${ANSI.reset}`);
  log(`${ANSI.bold}${ANSI.cyan}│       Jitre MCP — installer         │${ANSI.reset}`);
  log(`${ANSI.bold}${ANSI.cyan}╰─────────────────────────────────────╯${ANSI.reset}`);
  log('');
};

// ─── CLI args ──────────────────────────────────────────────────────────────

function parseArgs() {
  const out = {};
  for (const raw of process.argv.slice(2)) {
    if (raw === '--help' || raw === '-h') out.help = true;
    else if (raw === '--yes' || raw === '-y') out.yes = true;
    else {
      const m = raw.match(/^--([^=]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

function showHelp() {
  log(`
Usage: npm run mcp:setup -- [flags]

Flags:
  --client=<target>     claude-code | desktop | cursor | all | print
  --api=<url>           JITRE_API_URL (default: http://localhost:3000)
  --email=<email>       JITRE_EMAIL
  --password=<pwd>      JITRE_PASSWORD
  --token=<token>       JITRE_ACCESS_TOKEN (alternativa a email/password)
  --yes                 No pedir confirmaciones
  --help, -h            Mostrar esto

Ejemplos:
  npm run mcp:setup
  npm run mcp:setup -- --client=claude-code --email=admin@jitre.test --password=admin123
  npm run mcp:setup -- --client=print
`);
}

// ─── build check ───────────────────────────────────────────────────────────

function ensureBuild() {
  if (existsSync(DIST_PATH)) {
    ok(`Build encontrado: ${DIST_PATH}`);
    return;
  }
  info('No hay build. Corriendo `npm install && npm run build` en packages/mcp-server…');
  const npmCmd = platform() === 'win32' ? 'npm.cmd' : 'npm';
  const install = spawnSync(npmCmd, ['install', '--no-audit', '--no-fund'], {
    cwd: MCP_DIR,
    stdio: 'inherit',
  });
  if (install.status !== 0) {
    err('npm install falló en packages/mcp-server.');
    process.exit(1);
  }
  const build = spawnSync(npmCmd, ['run', 'build'], {
    cwd: MCP_DIR,
    stdio: 'inherit',
  });
  if (build.status !== 0) {
    err('npm run build falló en packages/mcp-server.');
    process.exit(1);
  }
  if (!existsSync(DIST_PATH)) {
    err(`Build OK pero ${DIST_PATH} no apareció.`);
    process.exit(1);
  }
  ok(`Build listo: ${DIST_PATH}`);
}

// ─── target config paths ───────────────────────────────────────────────────

function claudeDesktopConfigPath() {
  if (platform() === 'win32') {
    return join(process.env.APPDATA ?? '', 'Claude', 'claude_desktop_config.json');
  }
  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

function cursorConfigPath() {
  return join(homedir(), '.cursor', 'mcp.json');
}

function mergeMcpConfig(filePath, serverConfig) {
  let cfg = { mcpServers: {} };
  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      cfg = JSON.parse(raw);
      if (typeof cfg !== 'object' || cfg === null) cfg = { mcpServers: {} };
      if (!cfg.mcpServers || typeof cfg.mcpServers !== 'object') cfg.mcpServers = {};
    } catch (e) {
      warn(`No pude parsear ${filePath} — voy a sobreescribirlo.`);
      cfg = { mcpServers: {} };
    }
  }
  cfg.mcpServers.jitre = serverConfig;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(cfg, null, 2) + '\n');
}

// ─── installers ────────────────────────────────────────────────────────────

function installClaudeCode(serverConfig) {
  // Try `claude mcp add` via the CLI.
  const args = [
    'mcp', 'add', 'jitre',
    'node', serverConfig.args[0],
  ];
  for (const [k, v] of Object.entries(serverConfig.env)) {
    args.push('-e', `${k}=${v}`);
  }
  const result = spawnSync('claude', args, { stdio: 'inherit', shell: true });
  if (result.status === 0) {
    ok('Registrado en Claude Code (CLI).');
    return true;
  }
  err('`claude mcp add` falló. ¿Tenés Claude Code instalado y en PATH?');
  return false;
}

function installClaudeDesktop(serverConfig) {
  const path = claudeDesktopConfigPath();
  mergeMcpConfig(path, serverConfig);
  ok(`Escrito en ${path}`);
  warn('Reiniciá Claude Desktop para que aparezcan las tools.');
  return true;
}

function installCursor(serverConfig) {
  const path = cursorConfigPath();
  mergeMcpConfig(path, serverConfig);
  ok(`Escrito en ${path}`);
  warn('Reiniciá Cursor para que aparezcan las tools.');
  return true;
}

function printConfig(serverConfig) {
  log('');
  log('Pegá esto en la config de tu cliente MCP:');
  log('');
  log(JSON.stringify({ mcpServers: { jitre: serverConfig } }, null, 2));
}

// ─── interactive prompt ────────────────────────────────────────────────────

async function ask(rl, question, def) {
  const suffix = def ? ` ${ANSI.dim}[${def}]${ANSI.reset}` : '';
  const ans = (await rl.question(`${question}${suffix}: `)).trim();
  return ans || def || '';
}

/**
 * Read a single line from stdin without echoing it (for passwords).
 * Uses raw mode so each byte is read as the user types and we choose
 * whether to print it. Falls back to ask() if stdin is not a TTY.
 */
async function askSecret(rl, question) {
  if (!process.stdin.isTTY) return ask(rl, `${question} (visible)`, '');
  process.stdout.write(`${question}: `);
  return new Promise((resolveP) => {
    const stdin = process.stdin;
    let buf = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (ch === '\n' || ch === '\r') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolveP(buf);
          return;
        }
        if (code === 3) {
          // Ctrl+C — exit cleanly.
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (code === 8 || code === 127) {
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        buf += ch;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

async function askChoice(rl, question, options) {
  log('');
  log(question);
  options.forEach((opt, i) => {
    log(`  ${ANSI.cyan}${i + 1}${ANSI.reset}) ${opt.label}`);
  });
  while (true) {
    const ans = (await rl.question('> ')).trim();
    const idx = parseInt(ans, 10);
    if (idx >= 1 && idx <= options.length) return options[idx - 1].value;
    warn('Elegí un número de la lista.');
  }
}

// ─── main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  if (args.help) {
    showHelp();
    return;
  }

  banner();
  ensureBuild();

  let apiUrl = args.api;
  let email = args.email;
  let password = args.password;
  let token = args.token;
  let client = args.client;

  const interactive = !client || !(token || (email && password));

  if (interactive) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      apiUrl = apiUrl ?? (await ask(rl, 'JITRE_API_URL', 'http://localhost:3000'));
      if (!token) {
        email = email ?? (await ask(rl, 'JITRE_EMAIL', 'admin@jitre.test'));
        password = password ?? (await askSecret(rl, 'JITRE_PASSWORD'));
        if (!password) {
          token = await askSecret(rl, 'O en su lugar, JITRE_ACCESS_TOKEN');
        }
      }
      if (!password && !token) {
        err('Necesito email+password o un access token. Cancelo.');
        process.exit(1);
      }
      client = client ?? (await askChoice(rl, '¿Dónde registrarlo?', [
        { label: 'Claude Code (CLI) — recomendado si lo usás', value: 'claude-code' },
        { label: 'Claude Desktop', value: 'desktop' },
        { label: 'Cursor', value: 'cursor' },
        { label: 'Todos los anteriores', value: 'all' },
        { label: 'Solo mostrame el JSON, lo pego yo', value: 'print' },
      ]));
    } finally {
      rl.close();
    }
  }

  apiUrl = (apiUrl || 'http://localhost:3000').replace(/\/+$/, '');

  const env = { JITRE_API_URL: apiUrl };
  if (token) env.JITRE_ACCESS_TOKEN = token;
  else {
    env.JITRE_EMAIL = email;
    env.JITRE_PASSWORD = password;
  }

  const serverConfig = {
    command: 'node',
    args: [DIST_PATH],
    env,
  };

  log('');
  info(`Cliente:  ${client}`);
  info(`API URL:  ${apiUrl}`);
  info(`Auth:     ${token ? 'access-token' : `email (${email})`}`);
  info(`Server:   ${DIST_PATH}`);
  log('');

  let success = false;
  switch (client) {
    case 'claude-code':
      success = installClaudeCode(serverConfig);
      break;
    case 'desktop':
      success = installClaudeDesktop(serverConfig);
      break;
    case 'cursor':
      success = installCursor(serverConfig);
      break;
    case 'all': {
      const a = installClaudeCode(serverConfig);
      log('');
      const b = installClaudeDesktop(serverConfig);
      log('');
      const c = installCursor(serverConfig);
      success = a || b || c;
      break;
    }
    case 'print':
      printConfig(serverConfig);
      success = true;
      break;
    default:
      err(`Cliente desconocido: ${client}`);
      process.exit(1);
  }

  log('');
  if (success) {
    ok('Listo. Probalo con: "listame mis tareas de Jitre".');
  } else {
    err('La instalación no pudo completarse. Revisá los mensajes de arriba.');
    process.exit(1);
  }
}

main().catch((e) => {
  err(e?.message ?? String(e));
  process.exit(1);
});
