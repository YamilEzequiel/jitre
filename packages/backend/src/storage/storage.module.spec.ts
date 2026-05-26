import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageModule } from './storage.module';
import { STORAGE_DRIVER } from './storage.constants';
import { LocalStorageDriver } from './drivers/local.storage.driver';
import { S3StorageDriver } from './drivers/s3.storage.driver';

function makeConfigService(driver: string): ConfigService {
  return {
    get: (key: string, defaultVal?: unknown) => {
      const map: Record<string, unknown> = {
        'storage.driver': driver,
        'storage.localRoot': '/tmp/test-uploads',
        'storage.localSigningSecret': 'secret',
        'storage.publicBaseUrl': 'http://localhost:3000/api/v1/files',
        'storage.s3.region': 'us-east-1',
        'storage.s3.accessKeyId': '',
        'storage.s3.secretAccessKey': '',
        'storage.s3.bucket': '',
        'storage.s3.endpoint': '',
      };
      return map[key] !== undefined ? map[key] : defaultVal;
    },
  } as unknown as ConfigService;
}

describe('StorageModule.forRoot()', () => {
  async function buildModule(driver: string) {
    return Test.createTestingModule({
      imports: [
        {
          module: class FakeConfigModule {},
          providers: [
            {
              provide: ConfigService,
              useValue: makeConfigService(driver),
            },
          ],
          exports: [ConfigService],
          global: true,
        },
        StorageModule.forRoot(),
      ],
    }).compile();
  }

  it('resolves LocalStorageDriver when STORAGE_DRIVER=local', async () => {
    const module = await buildModule('local');
    const d = module.get(STORAGE_DRIVER);
    expect(d).toBeInstanceOf(LocalStorageDriver);
    expect(d.name).toBe('local');
  });

  it('resolves S3StorageDriver when STORAGE_DRIVER=s3', async () => {
    const module = await buildModule('s3');
    const d = module.get(STORAGE_DRIVER);
    expect(d).toBeInstanceOf(S3StorageDriver);
    expect(d.name).toBe('s3');
  });
});
