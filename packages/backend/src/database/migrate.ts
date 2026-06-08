/* eslint-disable no-console */
/**
 * Standalone migration runner for runtime containers.
 *
 * The TypeORM CLI (`typeorm-ts-node-commonjs`) is a dev-time tool; in a
 * production-style image (the demo stack runs `npm ci --omit=dev`) we
 * can't rely on it. This script imports the compiled DataSource, opens
 * a connection and runs pending migrations to completion.
 *
 * Usage (inside the container):
 *   node packages/backend/dist/database/migrate.js
 *
 * Exits 0 on success, 1 on any failure so docker compose
 * `service_completed_successfully` gates downstream services correctly.
 */
import 'reflect-metadata';
import { AppDataSource } from './data-source';

async function main(): Promise<void> {
  const ds = await AppDataSource.initialize();
  try {
    const applied = await ds.runMigrations({ transaction: 'all' });
    if (applied.length === 0) {
      console.log('No pending migrations — schema is already up to date.');
    } else {
      console.log(`Applied ${applied.length} migration(s):`);
      for (const m of applied) console.log(`  ✓ ${m.name}`);
    }
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('Migration run failed:', err);
  process.exit(1);
});
