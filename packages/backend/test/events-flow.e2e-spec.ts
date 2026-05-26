import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

/**
 * Event-flow E2E: register user → verify audit_logs rows created.
 *
 * Requires real Postgres. Run with:
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */
describe('Event flow (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

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
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('register emits user.registered + workspace.created + workspace.member.added + session.created → 4 audit rows', async () => {
    const email = `events-flow-${Date.now()}@test.com`;

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'ValidPass1!',
        displayName: 'Events Test User',
        deviceInfo: { userAgent: 'test', ip: '127.0.0.1' },
      })
      .expect(201);

    const userId = (res.body as { user: { id: string } }).user.id;
    expect(userId).toBeDefined();

    // Give the async listeners a tick to process
    await new Promise((resolve) => setTimeout(resolve, 100));

    const rows = await dataSource.query<
      { action: string; event_id: string; diff: unknown }[]
    >(
      `SELECT action, event_id, diff FROM audit_logs WHERE actor_user_id = $1 ORDER BY occurred_at ASC`,
      [userId],
    );

    const actions = rows.map((r) => r.action);
    expect(actions).toContain('USER_REGISTERED');
    expect(actions).toContain('WORKSPACE_CREATED');
    expect(actions).toContain('WORKSPACE_MEMBER_ADDED');
    expect(actions).toContain('SESSION_CREATED');

    // Verify eventId is set and unique per row
    const eventIds = rows.map((r) => r.event_id);
    const uniqueEventIds = new Set(eventIds);
    expect(uniqueEventIds.size).toBe(eventIds.length);

    // Verify no PII keys in diff
    const userRegisteredRow = rows.find((r) => r.action === 'USER_REGISTERED');
    expect(userRegisteredRow).toBeDefined();
    const diff = userRegisteredRow!.diff as Record<string, unknown>;
    expect(diff['password']).toBeUndefined();
    expect(diff['passwordHash']).toBeUndefined();
    expect(diff['email']).toBe(email);
  });

  it('idempotency: same eventId produces only one audit row', async () => {
    const countBefore = await dataSource.query<[{ count: string }]>(
      `SELECT COUNT(*) as count FROM audit_logs`,
    );
    const before = parseInt(countBefore[0].count, 10);

    // Simulate duplicate by inserting the same eventId twice
    const eventId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    await dataSource.query(
      `INSERT INTO audit_logs
        (workspace_id, action, subject_type, subject_id, summary, diff, event_id)
       VALUES
        ((SELECT id FROM workspaces LIMIT 1), 'USER_REGISTERED', 'User', gen_random_uuid(), 'test', '{}', $1)
       ON CONFLICT DO NOTHING`,
      [eventId],
    );
    await dataSource.query(
      `INSERT INTO audit_logs
        (workspace_id, action, subject_type, subject_id, summary, diff, event_id)
       VALUES
        ((SELECT id FROM workspaces LIMIT 1), 'USER_REGISTERED', 'User', gen_random_uuid(), 'test', '{}', $1)
       ON CONFLICT DO NOTHING`,
      [eventId],
    );

    const countAfter = await dataSource.query<[{ count: string }]>(
      `SELECT COUNT(*) as count FROM audit_logs WHERE event_id = $1`,
      [eventId],
    );
    expect(parseInt(countAfter[0].count, 10)).toBe(1);

    void before; // suppress unused warning
  });

  it('workspace.created + workspace.member.added audit rows present after create workspace', async () => {
    // Register user A
    const emailA = `events-ws-${Date.now()}@test.com`;
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: emailA,
        password: 'ValidPass1!',
        displayName: 'WS Events User',
        deviceInfo: { userAgent: 'test', ip: '127.0.0.1' },
      })
      .expect(201);

    const { accessToken } = registerRes.body as { accessToken: string };

    // Create a second workspace
    const wsRes = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Audit WS' })
      .expect(201);

    const wsId = (wsRes.body as { id: string }).id;
    expect(wsId).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 100));

    const rows = await dataSource.query<{ action: string }[]>(
      `SELECT action FROM audit_logs WHERE workspace_id = $1 ORDER BY occurred_at ASC`,
      [wsId],
    );
    const actions = rows.map((r) => r.action);
    expect(actions).toContain('WORKSPACE_CREATED');
    expect(actions).toContain('WORKSPACE_MEMBER_ADDED');
  });
});
