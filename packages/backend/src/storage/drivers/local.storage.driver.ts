import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetResult,
  IStorageDriver,
  PutInput,
  PutResult,
  SignedUrlOptions,
} from './storage-driver.interface';
import { signKey } from '../signed-url.util';

@Injectable()
export class LocalStorageDriver implements IStorageDriver {
  readonly name = 'local' as const;

  private readonly root: string;
  private readonly signingSecret: string;
  private readonly publicBaseUrl: string;
  private readonly logger = new Logger(LocalStorageDriver.name);

  constructor(private readonly configService: ConfigService) {
    this.root = path.resolve(
      configService.get<string>('storage.localRoot', './uploads'),
    );
    this.signingSecret = configService.get<string>(
      'storage.localSigningSecret',
      '',
    );
    this.publicBaseUrl = configService.get<string>(
      'storage.publicBaseUrl',
      'http://localhost:3000/api/v1/files',
    );
  }

  private resolveSafe(key: string): string {
    if (path.isAbsolute(key)) {
      throw new BadRequestException('UNSAFE_PATH');
    }
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root + path.sep) && resolved !== this.root) {
      throw new BadRequestException('UNSAFE_PATH');
    }
    return resolved;
  }

  async put(input: PutInput): Promise<PutResult> {
    const absolutePath = this.resolveSafe(input.key);
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true });

    const hash = crypto.createHash('sha256');
    const body = Buffer.isBuffer(input.body)
      ? Readable.from(input.body)
      : input.body;

    let sizeBytes = 0;
    const hashStream = new Transform({
      transform(
        chunk: Buffer,
        _enc: string,
        cb: (err: Error | null, data: Buffer) => void,
      ) {
        hash.update(chunk);
        sizeBytes += chunk.length;
        cb(null, chunk);
      },
    });

    const writeStream = fs.createWriteStream(absolutePath);
    await pipeline(body, hashStream, writeStream);

    const checksum = hash.digest('hex');
    return { key: input.key, sizeBytes, checksum };
  }

  async get(key: string): Promise<GetResult> {
    const absolutePath = this.resolveSafe(key);
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(absolutePath);
    } catch {
      throw new NotFoundException('FILE_NOT_FOUND');
    }

    const stream = fs.createReadStream(absolutePath);
    return {
      stream,
      sizeBytes: stat.size,
      contentType: 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    const absolutePath = this.resolveSafe(key);
    try {
      await fsp.unlink(absolutePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error({ key, err }, 'LocalStorageDriver.delete failed');
        throw err;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const absolutePath = this.resolveSafe(key);
    try {
      await fsp.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    const { token, expiresAt } = signKey(
      key,
      options.ttlSeconds,
      this.signingSecret,
    );
    const encodedKey = encodeURIComponent(key);
    return Promise.resolve(
      `${this.publicBaseUrl}/${encodedKey}?token=${token}&exp=${expiresAt}`,
    );
  }
}
