#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Jitre VS Code extension — one-shot installer.
 *
 *   npm run vscode:install                  → modo interactivo
 *   npm run vscode:install -- --editor=...  → modo no-interactivo (ver --help)
 *
 * Builda, empaqueta (.vsix), e instala en el editor que elijas (VS Code,
 * VS Code Insiders, VSCodium, Cursor). Detecta cuál tenés en el PATH.
 */
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { platform } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const EXT_DIR = resolve(REPO_ROOT, 'packages/vscode-extension');

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
  log(`${ANSI.bold}${ANSI.cyan}╭───────────────────────────────────────────╮${ANSI.reset}`);
  log(`${ANSI.bold}${ANSI.cyan}│   Jitre VS Code extension — installer     │${ANSI.reset}`);
  log(`${ANSI.bold}${ANSI.cyan}╰───────────────────────────────────────────╯${ANSI.reset}`);
  log('');
};

// ─── CLI args ──────────────────────────────────────────────────────────────

function parseArgs() {
  const out = {};
  for (const raw of process.argv.slice(2)) {
    if (raw === '--help' || raw === '-h') out.help = true;
    else if (raw === '--yes' || raw === '-y') out.yes = true;
    else if (raw === '--force-rebuild') out.forceRebuild = true;
    else {
      const m = raw.match(/^--([^=]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

function showHelp() {
  log(`
Usage: npm run vscode:install -- [flags]

Flags:
  --editor=<target>     code | code-insiders | codium | cursor | all
  --force-rebuild       Borra y regenera el .vsix
  --yes                 Saltea confirmaciones interactivas
  --help, -h            Mostrar esto

Ejemplos:
  npm run vscode:install
  npm run vscode:install -- --editor=code
  npm run vscode:install -- --editor=cursor --force-rebuild
`);
}

// ─── helpers ───────────────────────────────────────────────────────────────

const isWin = platform() === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

function which(cmd) {
  const finder = isWin ? 'where' : 'which';
  const r = spawnSync(finder, [cmd], { stdio: 'pipe', shell: false });
  if (r.status !== 0) return null;
  return r.stdout.toString().split(/\r?\n/).filter(Boolean)[0] ?? null;
}

function run(cmd, args, opts = {}) {
  // Windows .cmd shims (npm.cmd, npx.cmd, code.cmd) require shell:true.
  // We compose a quoted command string to control argument escaping.
  if (isWin) {
    const quote = (s) =>
      /[\s"&|<>^]/.test(s) ? `"${String(s).replace(/"/g, '\\"')}"` : s;
    const line = [cmd, ...args].map(quote).join(' ');
    return spawnSync(line, {
      cwd: opts.cwd ?? REPO_ROOT,
      stdio: opts.silent ? 'pipe' : 'inherit',
      shell: true,
    });
  }
  return spawnSync(cmd, args, {
    cwd: opts.cwd ?? REPO_ROOT,
    stdio: opts.silent ? 'pipe' : 'inherit',
    shell: false,
  });
}

const EDITORS = [
  { key: 'code', label: 'VS Code', cmd: isWin ? 'code.cmd' : 'code' },
  { key: 'code-insiders', label: 'VS Code Insiders', cmd: isWin ? 'code-insiders.cmd' : 'code-insiders' },
  { key: 'codium', label: 'VSCodium', cmd: isWin ? 'codium.cmd' : 'codium' },
  { key: 'cursor', label: 'Cursor', cmd: isWin ? 'cursor.cmd' : 'cursor' },
];

function detectEditors() {
  return EDITORS.map((e) => ({ ...e, path: which(e.cmd) })).filter((e) => e.path);
}

// ─── build pipeline ────────────────────────────────────────────────────────

function ensureNodeModules() {
  if (existsSync(join(EXT_DIR, 'node_modules'))) {
    ok('node_modules presente.');
    return;
  }
  info('Instalando dependencias en packages/vscode-extension…');
  const r = run(npmCmd, ['install', '--no-audit', '--no-fund'], { cwd: EXT_DIR });
  if (r.status !== 0) {
    err('npm install falló.');
    process.exit(1);
  }
  ok('Dependencias instaladas.');
}

function ensureBuild() {
  const outDir = join(EXT_DIR, 'out');
  if (existsSync(join(outDir, 'extension.js'))) {
    ok('Build encontrado: out/extension.js');
    return;
  }
  info('Buildeando (tsc -p ./)…');
  const r = run(npmCmd, ['run', 'build'], { cwd: EXT_DIR });
  if (r.status !== 0) {
    err('Build falló.');
    process.exit(1);
  }
  ok('Build OK.');
}

function findExistingVsix() {
  if (!existsSync(EXT_DIR)) return null;
  const files = readdirSync(EXT_DIR)
    .filter((f) => f.endsWith('.vsix'))
    .map((f) => ({ name: f, path: join(EXT_DIR, f), mtime: statSync(join(EXT_DIR, f)).mtimeMs }));
  if (files.length === 0) return null;
  files.sort((a, b) => b.mtime - a.mtime);
  return files[0].path;
}

function ensureVsix(forceRebuild) {
  if (forceRebuild) {
    const existing = findExistingVsix();
    if (existing) {
      info(`Borrando .vsix anterior: ${existing}`);
      try {
        unlinkSync(existing);
      } catch (e) {
        warn(`No pude borrar: ${e.message}`);
      }
    }
  }
  let vsix = findExistingVsix();
  if (vsix) {
    ok(`Usando .vsix existente: ${vsix}`);
    return vsix;
  }
  info('Empaquetando .vsix…');
  const r = run(npmCmd, ['run', 'package'], { cwd: EXT_DIR });
  if (r.status !== 0) {
    err('vsce package falló.');
    process.exit(1);
  }
  vsix = findExistingVsix();
  if (!vsix) {
    err('Empaqueté pero no encuentro el .vsix.');
    process.exit(1);
  }
  ok(`Empaquetado: ${vsix}`);
  return vsix;
}

// ─── install into editor ───────────────────────────────────────────────────

function installInEditor(editor, vsixPath) {
  info(`Instalando en ${editor.label}…`);
  // Windows .cmd shims need shell:true; quote the args ourselves to be safe.
  const quote = (s) => (isWin ? `"${s.replace(/"/g, '\\"')}"` : s);
  const r = isWin
    ? spawnSync(
        `${quote(editor.path)} --install-extension ${quote(vsixPath)} --force`,
        { stdio: 'inherit', shell: true },
      )
    : spawnSync(editor.path, ['--install-extension', vsixPath, '--force'], {
        stdio: 'inherit',
        shell: false,
      });
  if (r.status !== 0) {
    err(`Instalación en ${editor.label} falló (exit ${r.status}).`);
    return false;
  }
  ok(`Instalado en ${editor.label}.`);
  return true;
}

// ─── interactive prompt ────────────────────────────────────────────────────

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

  ensureNodeModules();
  ensureBuild();
  const vsixPath = ensureVsix(args.forceRebuild);

  const detected = detectEditors();
  if (detected.length === 0) {
    err('No encuentro ningún editor compatible en el PATH (code, code-insiders, codium, cursor).');
    log('');
    log("Si tenés VS Code: abrí la paleta y corré 'Shell Command: Install code command in PATH'.");
    log(`Mientras tanto, instalalo a mano con tu editor favorito apuntando a:`);
    log(`  ${vsixPath}`);
    process.exit(1);
  }

  ok(`Editores detectados: ${detected.map((e) => e.label).join(', ')}`);

  let target = args.editor;
  if (!target) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      target = await askChoice(rl, '¿Dónde instalar la extensión?', [
        ...detected.map((e) => ({ label: e.label, value: e.key })),
        { label: 'Todos los detectados', value: 'all' },
      ]);
    } finally {
      rl.close();
    }
  }

  let editorsToInstall = [];
  if (target === 'all') {
    editorsToInstall = detected;
  } else {
    const match = detected.find((e) => e.key === target);
    if (!match) {
      err(`Editor '${target}' no está en el PATH (detectados: ${detected.map((e) => e.key).join(', ')}).`);
      process.exit(1);
    }
    editorsToInstall = [match];
  }

  log('');
  info(`Editor(es): ${editorsToInstall.map((e) => e.label).join(', ')}`);
  info(`VSIX:       ${vsixPath}`);
  log('');

  let success = true;
  for (const ed of editorsToInstall) {
    const r = installInEditor(ed, vsixPath);
    success = success && r;
    log('');
  }

  if (success) {
    ok('Listo. Abrí el editor → ícono J en la activity bar → Sign in.');
    if (editorsToInstall.length === 1) {
      log(`${ANSI.dim}   Si ya estaba abierto, reiniciá la ventana (Ctrl+Shift+P → "Reload Window").${ANSI.reset}`);
    }
  } else {
    err('Una o más instalaciones fallaron. Revisá los mensajes de arriba.');
    process.exit(1);
  }
}

main().catch((e) => {
  err(e?.message ?? String(e));
  process.exit(1);
});
