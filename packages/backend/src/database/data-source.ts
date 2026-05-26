import 'reflect-metadata';
import { readdirSync } from 'fs';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AuditSubscriber } from './subscribers/audit.subscriber';

/**
 * Single source of truth for the TypeORM DataSource. Used by:
 *   - the TypeORM CLI for migrations (via `typeorm-ts-node-commonjs -d ...`),
 *   - the runtime via `DatabaseModule` (`TypeOrmModule.forRootAsync`).
 *
 * Entities are picked up by glob from the dist or src tree so we don't have
 * to maintain a manual registry as the schema grows.
 */
function loadEnv(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require('dotenv') as { config?: () => void };
    dotenv.config?.();
  } catch {
    // dotenv not installed — that's fine, env vars are expected to be set.
  }
}

loadEnv();

const isProd = process.env.NODE_ENV === 'production';

const migrationsDir = join(__dirname, 'migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => /\.(ts|js)$/.test(f) && !f.endsWith('.spec.ts') && !f.endsWith('.spec.js'))
  .map((f) => join(migrationsDir, f));

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  username: process.env.POSTGRES_USER ?? 'jitre',
  password: process.env.POSTGRES_PASSWORD ?? 'jitre_dev',
  database: process.env.POSTGRES_DB ?? 'jitre',
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: migrationFiles,
  subscribers: [AuditSubscriber],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true',
  migrationsRun: false,
  migrationsTableName: 'jitre_migrations',
  ssl: isProd ? { rejectUnauthorized: false } : false,
};

export const AppDataSource = new DataSource(dataSourceOptions);
