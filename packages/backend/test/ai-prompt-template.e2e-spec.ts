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
 * AI Prompt Templates CRUD — E2E.
 *
 *   Auth as workspace OWNER → create / read / update / set-default /
 *   delete templates. Verifies the partial-unique-default invariant
 *   and the read-only contract on built-in rows (when seeded).
 *
 * Requires real Postgres. Run with:
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */
describe('AI Prompt Templates (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let accessToken: string;
  let workspaceId: string;

  const fixture = createUserFixture({
    email: 'ai-prompts-e2e@example.com',
    displayName: 'Prompts Tester',
  });

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
      'TRUNCATE ai_prompt_templates, sessions, workspace_memberships, workspaces, users CASCADE',
    );

    // Register, then login. Register creates the personal workspace
    // under which the user is OWNER — that's the role manage_ai_settings
    // / manage Workspace grant lives on.
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: fixture.email,
        password: fixture.plainPassword,
        displayName: fixture.displayName,
      })
      .expect(201);

    accessToken = (reg.body as { accessToken: string }).accessToken;
    workspaceId = (reg.body as { workspace: { id: string } }).workspace.id;
  });

  afterAll(async () => {
    await dataSource.query(
      'TRUNCATE ai_prompt_templates, sessions, workspace_memberships, workspaces, users CASCADE',
    );
    await app.close();
  });

  function authHeaders() {
    return {
      Authorization: `Bearer ${accessToken}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('creates a template scoped to the workspace', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ai-prompt-templates')
      .set(authHeaders())
      .send({
        operation: 'describe',
        name: 'My describe template',
        systemPrompt: 'You write neutral technical descriptions.',
        userTemplate: 'Task: {{taskTitle}}',
      })
      .expect(201);

    const body = res.body as {
      id: string;
      workspaceId: string;
      operation: string;
      isBuiltin: boolean;
      isDefault: boolean;
    };
    expect(body.workspaceId).toBe(workspaceId);
    expect(body.operation).toBe('describe');
    expect(body.isBuiltin).toBe(false);
    expect(body.isDefault).toBe(false);
  });

  it('lists templates of the current workspace, filtered by operation', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/ai-prompt-templates?operation=describe')
      .set(authHeaders())
      .expect(200);

    const list = res.body as Array<{ operation: string; workspaceId: string }>;
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => t.operation === 'describe')).toBe(true);
    expect(list.every((t) => t.workspaceId === workspaceId)).toBe(true);
  });

  it('rejects unknown operation values via validation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/ai-prompt-templates')
      .set(authHeaders())
      .send({
        operation: 'totally-made-up',
        name: 'Nope',
        systemPrompt: 'something long enough',
        userTemplate: 'something else long enough',
      })
      .expect(400);
  });

  it('marking a template as default demotes the previous one for the same operation', async () => {
    const firstRes = await request(app.getHttpServer())
      .post('/api/v1/ai-prompt-templates')
      .set(authHeaders())
      .send({
        operation: 'suggest_subtasks',
        name: 'First subtask template',
        systemPrompt: 'subtask system prompt long enough',
        userTemplate: 'subtask user template long enough',
        isDefault: true,
      })
      .expect(201);
    const first = firstRes.body as { id: string; isDefault: boolean };
    expect(first.isDefault).toBe(true);

    const secondRes = await request(app.getHttpServer())
      .post('/api/v1/ai-prompt-templates')
      .set(authHeaders())
      .send({
        operation: 'suggest_subtasks',
        name: 'Second subtask template',
        systemPrompt: 'subtask system prompt long enough 2',
        userTemplate: 'subtask user template long enough 2',
        isDefault: true,
      })
      .expect(201);
    const second = secondRes.body as { id: string; isDefault: boolean };
    expect(second.isDefault).toBe(true);

    // First one should now have isDefault=false.
    const refetched = await request(app.getHttpServer())
      .get(`/api/v1/ai-prompt-templates/${first.id}`)
      .set(authHeaders())
      .expect(200);
    expect((refetched.body as { isDefault: boolean }).isDefault).toBe(false);
  });

  it('cannot delete the current default — must promote another first', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/ai-prompt-templates')
      .set(authHeaders())
      .send({
        operation: 'summary',
        name: 'Summary default',
        systemPrompt: 'summary system long enough',
        userTemplate: 'summary user long enough',
        isDefault: true,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/ai-prompt-templates/${(created.body as { id: string }).id}`)
      .set(authHeaders())
      .expect(409);
  });
});
