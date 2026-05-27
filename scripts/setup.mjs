#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Jitre — one-shot setup orchestrator.
 *
 *   npm run setup
 *
 * Runs the steps a new developer would otherwise do by hand:
 *   1. Copy env.example → .env (if missing).
 *   2. Start Postgres + Redis via docker compose.
 *   3. Wait for Postgres to accept connections.
 *   4. Run pending migrations.
 *   5. Seed the database with demo data.
 *   6. Print credentials + next-step commands.
 *
 * Idempotent: each step checks state before acting so re-running the
 * script doesn't duplicate work.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ENV_EXAMPLE = resolve(ROOT, 'env.example');
const ENV_FILE = resolve(ROOT, '.env');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const step = (n, total, msg) =>
  console.log(`\n${colors.cyan}[${n}/${total}]${colors.reset} ${colors.bold}${msg}${colors.reset}`);
const ok = (msg) => console.log(`  ${colors.green}✓${colors.reset} ${msg}`);
const info = (msg) => console.log(`  ${colors.dim}${msg}${colors.reset}`);
const fail = (msg) => console.log(`  ${colors.red}✗${colors.reset} ${msg}`);

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: opts.cwd ?? ROOT,
    stdio: opts.silent ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
  return result;
}

function tryRun(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: opts.cwd ?? ROOT,
    stdio: 'pipe',
    shell: process.platform === 'win32',
    env: process.env,
  });
  return result;
}

async function waitForPostgres({ timeoutMs = 60000, intervalMs = 1500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const probe = tryRun('docker', [
      'exec',
      'jitre-postgres',
      'pg_isready',
      '-U',
      process.env.POSTGRES_USER ?? 'jitre',
      '-d',
      process.env.POSTGRES_DB ?? 'jitre',
    ]);
    if (probe.status === 0) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
    process.stdout.write('.');
  }
  return false;
}

async function main() {
  console.log(`${colors.magenta}${colors.bold}\nJitre setup${colors.reset}\n`);

  // 1. .env
  step(1, 5, 'Environment file');
  if (existsSync(ENV_FILE)) {
    ok('.env already present — leaving it untouched');
  } else {
    copyFileSync(ENV_EXAMPLE, ENV_FILE);
    ok('Created .env from env.example');
    info('Edit .env if you need to change ports, secrets or AI keys');
  }

  // 2. Docker compose up (postgres + redis)
  step(2, 5, 'Starting Postgres + Redis');
  run('docker', ['compose', 'up', '-d', 'postgres', 'redis']);
  ok('Containers up');

  // 3. Wait for Postgres
  step(3, 5, 'Waiting for Postgres');
  process.stdout.write('  ');
  const ready = await waitForPostgres();
  process.stdout.write('\n');
  if (!ready) {
    fail('Postgres did not become ready in 60s — check `docker compose logs postgres`');
    process.exit(1);
  }
  ok('Postgres is accepting connections');

  // 4. Migrations
  step(4, 5, 'Running migrations');
  run('npm', ['run', 'db:migration:run']);
  ok('Schema is up to date');

  // 5. Seed
  step(5, 5, 'Seeding demo data');
  // The backend workspace exposes `npm run seed` for this.
  try {
    run('npm', ['run', 'seed', '-w', '@jitre/backend']);
    ok('Demo data ready');
  } catch (err) {
    info('Seed script not present or failed — skipping (not fatal)');
  }

  // Final banner
  console.log(`\n${colors.green}${colors.bold}✓ Setup complete${colors.reset}\n`);
  console.log(`${colors.bold}Credentials${colors.reset}`);
  console.log(`  ${colors.cyan}admin@jitre.test${colors.reset}  /  ${colors.cyan}admin123${colors.reset}  ${colors.dim}(Owner)${colors.reset}`);
  console.log(`  ${colors.cyan}pm@jitre.test${colors.reset}     /  ${colors.cyan}pm123${colors.reset}     ${colors.dim}(Admin)${colors.reset}`);
  console.log(`  ${colors.cyan}dev1@jitre.test${colors.reset}   /  ${colors.cyan}dev123${colors.reset}    ${colors.dim}(Member)${colors.reset}`);
  console.log(`\n${colors.bold}Next steps${colors.reset}`);
  console.log(`  ${colors.blue}npm run dev:backend${colors.reset}    ${colors.dim}→ http://localhost:3000/api/v1/docs${colors.reset}`);
  console.log(`  ${colors.blue}npm run dev:frontend${colors.reset}   ${colors.dim}→ http://localhost:4200${colors.reset}`);
  console.log(`\n${colors.dim}Tip: ${colors.reset}${colors.yellow}docker compose -f compose.demo.yml up${colors.reset}${colors.dim} to boot the full stack with zero local deps.${colors.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${colors.red}Setup failed:${colors.reset} ${err.message}\n`);
  process.exit(1);
});
