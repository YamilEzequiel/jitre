import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3StorageDriver } from './s3.storage.driver';

@Injectable()
export class R2StorageDriver extends S3StorageDriver {
  override readonly name: 'local' | 's3' | 'r2' = 'r2';

  constructor(configService: ConfigService) {
    super(configService);
  }
}
