import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import {
  GetResult,
  IStorageDriver,
  PutInput,
  PutResult,
  SignedUrlOptions,
} from './storage-driver.interface';

@Injectable()
export class S3StorageDriver implements IStorageDriver {
  readonly name: 'local' | 's3' | 'r2' = 's3';

  protected readonly s3: S3Client;
  protected readonly bucket: string;
  protected readonly logger = new Logger(S3StorageDriver.name);

  constructor(protected readonly configService: ConfigService) {
    const region =
      configService.get<string>('storage.s3.region') || 'us-east-1';
    const accessKeyId = configService.get<string>('storage.s3.accessKeyId', '');
    const secretAccessKey = configService.get<string>(
      'storage.s3.secretAccessKey',
      '',
    );
    const endpoint = configService.get<string>('storage.s3.endpoint', '');

    this.bucket = configService.get<string>('storage.s3.bucket', '');

    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region,
      credentials: { accessKeyId, secretAccessKey },
    };

    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    this.s3 = new S3Client(clientConfig);
  }

  async put(input: PutInput): Promise<PutResult> {
    const body = Buffer.isBuffer(input.body)
      ? input.body
      : (input.body as Readable);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: body,
        ContentType: input.contentType,
        ContentLength: input.sizeBytes,
      }),
    );

    return { key: input.key, sizeBytes: input.sizeBytes ?? 0 };
  }

  async get(key: string): Promise<GetResult> {
    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    return {
      stream: response.Body as NodeJS.ReadableStream,
      sizeBytes: response.ContentLength ?? 0,
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (err: unknown) {
      const e = err as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        e.name === 'NotFound' ||
        e.name === 'NoSuchKey' ||
        e.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw err;
    }
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    return getS3SignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: options.ttlSeconds },
    );
  }
}
