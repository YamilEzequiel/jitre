import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageDriver } from './drivers/local.storage.driver';
import { S3StorageDriver } from './drivers/s3.storage.driver';
import { R2StorageDriver } from './drivers/r2.storage.driver';
import { STORAGE_DRIVER } from './storage.constants';
import { IStorageDriver } from './drivers/storage-driver.interface';

@Global()
@Module({})
export class StorageModule {
  static forRoot(): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        LocalStorageDriver,
        S3StorageDriver,
        R2StorageDriver,
        {
          provide: STORAGE_DRIVER,
          inject: [
            ConfigService,
            LocalStorageDriver,
            S3StorageDriver,
            R2StorageDriver,
          ],
          useFactory: (
            cfg: ConfigService,
            local: LocalStorageDriver,
            s3: S3StorageDriver,
            r2: R2StorageDriver,
          ): IStorageDriver => {
            const which = cfg.get<string>('storage.driver', 'local');
            if (which === 's3') return s3;
            if (which === 'r2') return r2;
            return local;
          },
        },
      ],
      exports: [STORAGE_DRIVER],
    };
  }
}
