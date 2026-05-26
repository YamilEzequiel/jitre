import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AuditSubscriber } from './subscribers/audit.subscriber';
import type { DatabaseConfig } from '../config/database.config';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.getOrThrow<DatabaseConfig>('database');
        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          autoLoadEntities: true,
          synchronize: db.synchronize,
          logging: db.logging,
          namingStrategy: new SnakeNamingStrategy(),
          subscribers: [AuditSubscriber],
          migrationsTableName: 'jitre_migrations',
          migrations: [__dirname + '/migrations/*.{ts,js}'],
        };
      },
    }),
  ],
})
export class DatabaseModule {}
