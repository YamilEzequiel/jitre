import { registerAs } from '@nestjs/config';

export type DatabaseConfig = ReturnType<typeof databaseConfigFactory>;

const databaseConfigFactory = () => ({
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  username: process.env.POSTGRES_USER ?? 'jitre',
  password: process.env.POSTGRES_PASSWORD ?? 'jitre_dev',
  database: process.env.POSTGRES_DB ?? 'jitre',
  logging: process.env.DATABASE_LOGGING === 'true',
  synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
});

export const databaseConfig = registerAs('database', databaseConfigFactory);
