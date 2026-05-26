export interface PutInput {
  key: string;
  body: Buffer | NodeJS.ReadableStream;
  contentType: string;
  sizeBytes?: number;
}

export interface PutResult {
  key: string;
  sizeBytes: number;
  checksum?: string;
}

export interface GetResult {
  stream: NodeJS.ReadableStream;
  sizeBytes: number;
  contentType: string;
}

export interface SignedUrlOptions {
  ttlSeconds: number;
}

export interface IStorageDriver {
  readonly name: 'local' | 's3' | 'r2';
  put(input: PutInput): Promise<PutResult>;
  get(key: string): Promise<GetResult>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;
}
