import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { ConfigService } from '@nestjs/config';
import { S3StorageDriver } from './s3.storage.driver';
import { Readable } from 'node:stream';

const s3Mock = mockClient(S3Client);

function makeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const defaults: Record<string, unknown> = {
    'storage.s3.region': 'us-east-1',
    'storage.s3.accessKeyId': 'test-key',
    'storage.s3.secretAccessKey': 'test-secret',
    'storage.s3.bucket': 'test-bucket',
    'storage.s3.endpoint': '',
  };
  return {
    get: (key: string, defaultVal?: unknown) =>
      Object.prototype.hasOwnProperty.call(overrides, key)
        ? overrides[key]
        : (defaults[key] ?? defaultVal),
  } as unknown as ConfigService;
}

describe('S3StorageDriver', () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  it('has name "s3"', () => {
    const driver = new S3StorageDriver(makeConfig());
    expect(driver.name).toBe('s3');
  });

  describe('put', () => {
    it('issues PutObjectCommand with correct Bucket and Key', async () => {
      s3Mock.on(PutObjectCommand).resolves({});
      const driver = new S3StorageDriver(makeConfig());
      const buffer = Buffer.from('hello');

      const result = await driver.put({
        key: 'test/file.txt',
        body: buffer,
        contentType: 'text/plain',
        sizeBytes: buffer.length,
      });

      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.Bucket).toBe('test-bucket');
      expect(calls[0].args[0].input.Key).toBe('test/file.txt');
      expect(calls[0].args[0].input.ContentType).toBe('text/plain');
      expect(result.key).toBe('test/file.txt');
    });
  });

  describe('get', () => {
    it('returns a stream from GetObjectCommand response', async () => {
      const body = Readable.from(['hello']);
      s3Mock.on(GetObjectCommand).resolves({
        Body: body as unknown,
        ContentLength: 5,
        ContentType: 'text/plain',
      });

      const driver = new S3StorageDriver(makeConfig());
      const result = await driver.get('test/file.txt');

      expect(result.sizeBytes).toBe(5);
      expect(result.contentType).toBe('text/plain');
      expect(result.stream).toBeDefined();
    });
  });

  describe('delete', () => {
    it('issues DeleteObjectCommand', async () => {
      s3Mock.on(DeleteObjectCommand).resolves({});
      const driver = new S3StorageDriver(makeConfig());
      await driver.delete('test/file.txt');
      expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(1);
    });
  });

  describe('exists', () => {
    it('returns true when HeadObjectCommand succeeds', async () => {
      s3Mock.on(HeadObjectCommand).resolves({});
      const driver = new S3StorageDriver(makeConfig());
      expect(await driver.exists('test/file.txt')).toBe(true);
    });

    it('returns false when HeadObjectCommand throws NotFound', async () => {
      s3Mock.on(HeadObjectCommand).rejects({ name: 'NotFound' });
      const driver = new S3StorageDriver(makeConfig());
      expect(await driver.exists('test/file.txt')).toBe(false);
    });

    it('returns false when HeadObjectCommand throws 404', async () => {
      const err = Object.assign(new Error('Not found'), {
        $metadata: { httpStatusCode: 404 },
      });
      s3Mock.on(HeadObjectCommand).rejects(err);
      const driver = new S3StorageDriver(makeConfig());
      expect(await driver.exists('test/file.txt')).toBe(false);
    });
  });
});
