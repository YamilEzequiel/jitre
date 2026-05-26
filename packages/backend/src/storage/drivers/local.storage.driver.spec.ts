import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageDriver } from './local.storage.driver';

function makeConfig(root: string): ConfigService {
  return {
    get: (key: string, defaultVal?: unknown) => {
      const map: Record<string, unknown> = {
        'storage.localRoot': root,
        'storage.localSigningSecret': 'test-secret-abc123def456ghi789',
        'storage.publicBaseUrl': 'http://localhost:3000/api/v1/files',
      };
      return map[key] ?? defaultVal;
    },
  } as unknown as ConfigService;
}

describe('LocalStorageDriver', () => {
  let tmpDir: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jitre-local-driver-'));
    driver = new LocalStorageDriver(makeConfig(tmpDir));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('has name "local"', () => {
    expect(driver.name).toBe('local');
  });

  describe('put', () => {
    it('writes file and returns correct sizeBytes and checksum', async () => {
      const buffer = Buffer.alloc(1024, 'x');
      const key = 'workspaces/W1/comment/C1/A1-test.txt';

      const result = await driver.put({
        key,
        body: buffer,
        contentType: 'text/plain',
      });

      expect(result.key).toBe(key);
      expect(result.sizeBytes).toBe(1024);
      expect(result.checksum).toBeDefined();
      expect(result.checksum).toHaveLength(64); // sha256 hex

      const written = await fs.readFile(path.join(tmpDir, key));
      expect(written).toEqual(buffer);
    });

    it('creates parent directories automatically', async () => {
      const key = 'deep/nested/path/file.txt';
      await driver.put({
        key,
        body: Buffer.from('hello'),
        contentType: 'text/plain',
      });
      const stat = await fs.stat(path.join(tmpDir, key));
      expect(stat.isFile()).toBe(true);
    });
  });

  describe('get', () => {
    it('returns stream and metadata for existing file', async () => {
      const buffer = Buffer.from('hello world');
      const key = 'test/hello.txt';
      await driver.put({ key, body: buffer, contentType: 'text/plain' });

      const result = await driver.get(key);
      expect(result.sizeBytes).toBe(buffer.length);

      const chunks: Buffer[] = [];
      for await (const chunk of result.stream) {
        chunks.push(chunk as Buffer);
      }
      expect(Buffer.concat(chunks)).toEqual(buffer);
    });

    it('throws NotFoundException for missing file', async () => {
      await expect(driver.get('nonexistent/key.txt')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('deletes an existing file', async () => {
      const key = 'test/to-delete.txt';
      await driver.put({
        key,
        body: Buffer.from('bye'),
        contentType: 'text/plain',
      });
      await driver.delete(key);
      await expect(driver.get(key)).rejects.toThrow(NotFoundException);
    });

    it('is idempotent — does not throw for missing file', async () => {
      await expect(
        driver.delete('nonexistent/key.txt'),
      ).resolves.toBeUndefined();
    });
  });

  describe('exists', () => {
    it('returns true for existing file', async () => {
      const key = 'test/exists.txt';
      await driver.put({
        key,
        body: Buffer.from('x'),
        contentType: 'text/plain',
      });
      expect(await driver.exists(key)).toBe(true);
    });

    it('returns false for missing file', async () => {
      expect(await driver.exists('nonexistent/key.txt')).toBe(false);
    });
  });

  describe('getSignedUrl', () => {
    it('returns a URL containing token and exp params', async () => {
      const key = 'test/file.txt';
      const url = await driver.getSignedUrl(key, { ttlSeconds: 300 });
      expect(url).toContain('token=');
      expect(url).toContain('exp=');
      expect(url).toContain(encodeURIComponent(key));
    });
  });

  describe('path safety', () => {
    it('rejects path traversal keys', async () => {
      await expect(
        driver.put({
          key: '../../etc/passwd',
          body: Buffer.from('x'),
          contentType: 'text/plain',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects absolute paths', async () => {
      await expect(
        driver.put({
          key: '/etc/passwd',
          body: Buffer.from('x'),
          contentType: 'text/plain',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
