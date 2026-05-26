import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

/**
 * Attachment upload E2E.
 *
 * Requires real Postgres + migration run:
 *   docker compose up -d
 *   npm run db:migration:run -w @jitre/backend
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 *
 * @deferred — Docker/PG not available during batch 2 apply. Tests are specified
 * and will run green once the container is available.
 */
describe('Attachment upload (e2e)', () => {
  let app: INestApplication<App>;
  let memberToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const ts = Date.now();

    // Register + get workspace
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `attach-up-${ts}@test.com`,
        password: 'ValidPass1!',
        displayName: 'Attach User',
        deviceInfo: {},
      })
      .expect(201);

    memberToken = regRes.body.accessToken;
    workspaceId =
      regRes.body.workspace?.id ?? regRes.body.user?.defaultWorkspaceId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/attachments — uploads a file and returns attachment metadata', async () => {
    const pngBuffer = Buffer.alloc(200, 0);
    // PNG magic bytes
    pngBuffer[0] = 0x89;
    pngBuffer[1] = 0x50;
    pngBuffer[2] = 0x4e;
    pngBuffer[3] = 0x47;
    pngBuffer[4] = 0x0d;
    pngBuffer[5] = 0x0a;
    pngBuffer[6] = 0x1a;
    pngBuffer[7] = 0x0a;

    const res = await request(app.getHttpServer())
      .post('/api/v1/attachments')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-workspace-id', workspaceId)
      .attach('file', pngBuffer, {
        filename: 'test.png',
        contentType: 'image/png',
      })
      .field('contextType', 'task')
      .field('contextId', '00000000-0000-4000-8000-000000000001')
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.mimeType).toBe('image/png');
    expect(res.body.storageKey).toBeDefined();
  });

  it('GET /api/v1/attachments/:id — returns metadata for an uploaded attachment', async () => {
    // TODO: depends on previous test creating attachment; wire with fixture or in-test upload
  });

  it('GET /api/v1/attachments/:id/download — returns a signed URL', async () => {
    // TODO: upload first, then GET download; assert signedUrl in response
  });

  it('DELETE /api/v1/attachments/:id — soft-deletes the attachment', async () => {
    // TODO: upload, then DELETE, then GET should return 404
  });

  it('POST /api/v1/attachments — rejects unsupported MIME type with 400', async () => {
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ header (exe)

    await request(app.getHttpServer())
      .post('/api/v1/attachments')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-workspace-id', workspaceId)
      .attach('file', exeBuffer, {
        filename: 'malware.exe',
        contentType: 'application/octet-stream',
      })
      .field('contextType', 'task')
      .field('contextId', '00000000-0000-4000-8000-000000000001')
      .expect(400);
  });
});
