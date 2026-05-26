import { registerAs } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { StorageDriver } from '@jitre/shared';

export type StorageConfig = ReturnType<typeof storageConfigFactory>;

const logger = new Logger('StorageConfig');

const storageConfigFactory = () => {
  const signingSecret =
    process.env.STORAGE_LOCAL_SIGNING_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    '';

  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.STORAGE_LOCAL_SIGNING_SECRET
  ) {
    logger.warn(
      'STORAGE_LOCAL_SIGNING_SECRET is not set in production — falling back to JWT_ACCESS_SECRET. Set a dedicated secret for storage signing.',
    );
  }

  return {
    driver:
      (process.env.STORAGE_DRIVER as StorageDriver) ?? StorageDriver.LOCAL,
    localRoot: process.env.STORAGE_LOCAL_ROOT ?? './uploads',
    maxFileSizeBytes:
      parseInt(process.env.STORAGE_MAX_FILE_SIZE_MB ?? '25', 10) * 1024 * 1024,
    publicBaseUrl:
      process.env.STORAGE_PUBLIC_BASE_URL ??
      'http://localhost:3000/api/v1/files',
    localSigningSecret: signingSecret,
    s3: {
      region: process.env.AWS_REGION ?? '',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      bucket: process.env.STORAGE_S3_BUCKET ?? '',
      endpoint: process.env.R2_ENDPOINT ?? '',
    },
  };
};

export const storageConfig = registerAs('storage', storageConfigFactory);
