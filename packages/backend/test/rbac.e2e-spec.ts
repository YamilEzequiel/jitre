import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { createUserFixture } from './fixtures/users.fixture';

/**
 * RBAC E2E:
 *   - GUEST cannot add members → 403 INSUFFICIENT_ROLE
 *   - ADMIN can add members → 201
 *   - Cannot remove last OWNER → 409 LAST_OWNER
 */
describe('RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  let ownerToken: string;
  let workspaceId: string;
  let guestUserId: string;

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

    dataSource = app.get(DataSource);
    await dataSource.query(
      'TRUNCATE sessions, workspace_memberships, workspaces, users CASCADE',
    );

    // Create OWNER
    const ownerFixture = createUserFixture({
      email: 'owner-rbac@example.com',
      displayName: 'Owner RBAC',
    });
    const regOwner = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: ownerFixture.email,
        password: ownerFixture.plainPassword,
        displayName: ownerFixture.displayName,
      })
      .expect(201);
    ownerToken = regOwner.body.accessToken as string;

    const wsRes = await request(app.getHttpServer())
      .get('/api/v1/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    workspaceId = (wsRes.body as Array<{ id: string }>)[0].id;

    // Create guest user (not yet added to workspace)
    const guestFixture = createUserFixture({
      email: 'guest-rbac@example.com',
      displayName: 'Guest RBAC',
    });
    const regGuest = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: guestFixture.email,
        password: guestFixture.plainPassword,
        displayName: guestFixture.displayName,
      })
      .expect(201);

    const guestMeRes = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${regGuest.body.accessToken as string}`)
      .expect(200);
    guestUserId = (guestMeRes.body as { id: string }).id;

    // Add guest user to owner's workspace with GUEST role
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ userId: guestUserId, role: 'GUEST' })
      .expect(201);
  });

  afterAll(async () => {
    await dataSource.query(
      'TRUNCATE sessions, workspace_memberships, workspaces, users CASCADE',
    );
    await app.close();
  });

  it('GUEST cannot add members → 403 INSUFFICIENT_ROLE', async () => {
    // Log in as guest
    const guestLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'guest-rbac@example.com', password: 'ValidPass1!Secure' })
      .expect(200);
    const guestToken = guestLogin.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${guestToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ userId: '00000000-0000-0000-0000-000000000099', role: 'MEMBER' })
      .expect(403);

    expect(JSON.stringify(res.body)).toMatch(/INSUFFICIENT_ROLE/i);
  });

  it('OWNER can add members → 201', async () => {
    const newUserFixture = createUserFixture({
      email: 'new-member-rbac@example.com',
      displayName: 'New Member',
    });
    const regNew = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: newUserFixture.email,
        password: newUserFixture.plainPassword,
        displayName: newUserFixture.displayName,
      })
      .expect(201);

    const newUserMeRes = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${regNew.body.accessToken as string}`)
      .expect(200);
    const newUserId = (newUserMeRes.body as { id: string }).id;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ userId: newUserId, role: 'MEMBER' })
      .expect(201);

    expect(res.body).toMatchObject({ role: 'MEMBER' });
  });

  it('cannot remove last OWNER → 409 LAST_OWNER', async () => {
    const ownerMeRes = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const ownerId = (ownerMeRes.body as { id: string }).id;

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/workspaces/${workspaceId}/members/${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(409);

    expect(JSON.stringify(res.body)).toMatch(/LAST_OWNER/i);
  });
});
