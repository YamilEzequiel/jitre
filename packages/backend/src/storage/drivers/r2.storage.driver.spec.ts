import { ConfigService } from '@nestjs/config';
import { R2StorageDriver } from './r2.storage.driver';

function makeConfig(
  endpoint = 'https://abc.r2.cloudflarestorage.com',
): ConfigService {
  return {
    get: (key: string, defaultVal?: unknown) => {
      const map: Record<string, unknown> = {
        'storage.s3.region': 'auto',
        'storage.s3.accessKeyId': 'r2-key',
        'storage.s3.secretAccessKey': 'r2-secret',
        'storage.s3.bucket': 'r2-bucket',
        'storage.s3.endpoint': endpoint,
      };
      return map[key] ?? defaultVal;
    },
  } as unknown as ConfigService;
}

describe('R2StorageDriver', () => {
  it('has name "r2"', () => {
    const driver = new R2StorageDriver(makeConfig());
    expect(driver.name).toBe('r2');
  });

  it('is an instance of R2StorageDriver', () => {
    const driver = new R2StorageDriver(makeConfig());
    expect(driver).toBeInstanceOf(R2StorageDriver);
  });

  it('constructs without errors with R2 endpoint', () => {
    expect(() => new R2StorageDriver(makeConfig())).not.toThrow();
  });
});
