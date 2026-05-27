import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { AiPromptTemplateService } from './ai-prompt-template.service';
import { AiPromptTemplateEntity } from './ai-prompt-template.entity';

/**
 * Spec uses a tiny in-memory shim for the repository — we only need to
 * exercise the service's invariants (only-one-default swap, can't edit
 * built-in, can't delete default), not TypeORM itself.
 */
function makeFakeRepo() {
  const rows: AiPromptTemplateEntity[] = [];

  const repo = {
    rows,
    manager: {
      transaction: jest.fn(async (cb: (mgr: unknown) => unknown) => cb({ getRepository: () => repo })),
    },
    find: jest.fn(async ({ where, order: _order }: { where: Record<string, unknown> }) => {
      return rows.filter((r) => {
        for (const [k, v] of Object.entries(where)) {
          if (k === 'deletedAt') continue; // IsNull() — we never set deletedAt in this fake
          if ((r as unknown as Record<string, unknown>)[k] !== v) return false;
        }
        return true;
      });
    }),
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      return repo.rows.find((r) => {
        for (const [k, v] of Object.entries(where)) {
          if (k === 'deletedAt') continue;
          if ((r as unknown as Record<string, unknown>)[k] !== v) return false;
        }
        return true;
      });
    }),
    create: jest.fn((data: Partial<AiPromptTemplateEntity>) => ({ ...data })),
    save: jest.fn(async (data: Partial<AiPromptTemplateEntity>) => {
      const incoming = data as AiPromptTemplateEntity;
      if (!incoming.id) {
        incoming.id = `id-${repo.rows.length + 1}`;
        repo.rows.push(incoming);
      } else {
        const idx = repo.rows.findIndex((r) => r.id === incoming.id);
        if (idx >= 0) repo.rows[idx] = incoming;
        else repo.rows.push(incoming);
      }
      return incoming;
    }),
    merge: jest.fn((base: AiPromptTemplateEntity, partial: Partial<AiPromptTemplateEntity>) => Object.assign(base, partial)),
    update: jest.fn(
      async (
        where: Record<string, unknown>,
        patch: Partial<AiPromptTemplateEntity>,
      ) => {
        let affected = 0;
        for (const r of repo.rows) {
          let match = true;
          for (const [k, v] of Object.entries(where)) {
            if (k === 'deletedAt') continue;
            if ((r as unknown as Record<string, unknown>)[k] !== v) {
              match = false;
              break;
            }
          }
          if (match) {
            Object.assign(r, patch);
            affected++;
          }
        }
        return { affected };
      },
    ),
    softDelete: jest.fn(async (id: string) => {
      const r = repo.rows.find((x) => x.id === id);
      if (r) (r as unknown as { deletedAt: Date }).deletedAt = new Date();
      return { affected: r ? 1 : 0 };
    }),
  };

  return repo;
}

describe('AiPromptTemplateService', () => {
  let service: AiPromptTemplateService;
  let repo: ReturnType<typeof makeFakeRepo>;

  beforeEach(async () => {
    repo = makeFakeRepo();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiPromptTemplateService,
        { provide: getRepositoryToken(AiPromptTemplateEntity), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(AiPromptTemplateService);
  });

  const WS = 'ws-1';
  const USER = 'user-1';

  it('creates a template', async () => {
    const created = await service.create(WS, USER, {
      operation: 'describe',
      name: 'My template',
      systemPrompt: 'do something nice',
      userTemplate: 'task: {{taskTitle}}',
    });
    expect(created.id).toBeDefined();
    expect(created.workspaceId).toBe(WS);
    expect(created.isBuiltin).toBe(false);
    expect(created.isDefault).toBe(false);
  });

  it('marking a new template as default demotes the previous default in the same op', async () => {
    const first = await service.create(WS, USER, {
      operation: 'describe',
      name: 'first',
      systemPrompt: 'x'.repeat(20),
      userTemplate: 'y'.repeat(20),
      isDefault: true,
    });
    const second = await service.create(WS, USER, {
      operation: 'describe',
      name: 'second',
      systemPrompt: 'x'.repeat(20),
      userTemplate: 'y'.repeat(20),
      isDefault: true,
    });

    const firstRow = repo.rows.find((r) => r.id === first.id);
    const secondRow = repo.rows.find((r) => r.id === second.id);
    expect(firstRow?.isDefault).toBe(false);
    expect(secondRow?.isDefault).toBe(true);
  });

  it('default swap is operation-scoped — other operations keep their defaults', async () => {
    await service.create(WS, USER, {
      operation: 'describe',
      name: 'describe-default',
      systemPrompt: 'x'.repeat(20),
      userTemplate: 'y'.repeat(20),
      isDefault: true,
    });
    await service.create(WS, USER, {
      operation: 'suggest_subtasks',
      name: 'subtasks-default',
      systemPrompt: 'x'.repeat(20),
      userTemplate: 'y'.repeat(20),
      isDefault: true,
    });

    const describe = repo.rows.find((r) => r.name === 'describe-default');
    const subtasks = repo.rows.find((r) => r.name === 'subtasks-default');
    expect(describe?.isDefault).toBe(true);
    expect(subtasks?.isDefault).toBe(true);
  });

  it('rejects editing a built-in template', async () => {
    const builtin = {
      id: 'builtin-1',
      workspaceId: WS,
      operation: 'describe',
      name: 'Built-in',
      isDefault: true,
      isBuiltin: true,
      systemPrompt: 'x',
      userTemplate: 'y',
      variables: [],
      description: null,
      createdByUserId: null,
    } as unknown as AiPromptTemplateEntity;
    repo.rows.push(builtin);

    await expect(service.update(WS, USER, 'builtin-1', { name: 'changed' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects changing a template operation', async () => {
    const created = await service.create(WS, USER, {
      operation: 'describe',
      name: 'a',
      systemPrompt: 'x'.repeat(20),
      userTemplate: 'y'.repeat(20),
    });
    await expect(
      service.update(WS, USER, created.id, { operation: 'suggest_subtasks' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('setDefault demotes the previous default', async () => {
    const a = await service.create(WS, USER, {
      operation: 'describe',
      name: 'a',
      systemPrompt: 'x'.repeat(20),
      userTemplate: 'y'.repeat(20),
      isDefault: true,
    });
    const b = await service.create(WS, USER, {
      operation: 'describe',
      name: 'b',
      systemPrompt: 'x'.repeat(20),
      userTemplate: 'y'.repeat(20),
    });

    await service.setDefault(WS, USER, b.id);

    expect(repo.rows.find((r) => r.id === a.id)?.isDefault).toBe(false);
    expect(repo.rows.find((r) => r.id === b.id)?.isDefault).toBe(true);
  });

  it('refuses to delete the current default', async () => {
    const created = await service.create(WS, USER, {
      operation: 'describe',
      name: 'a',
      systemPrompt: 'x'.repeat(20),
      userTemplate: 'y'.repeat(20),
      isDefault: true,
    });
    await expect(service.remove(WS, USER, created.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('getDefaultFor returns the workspace default for an operation', async () => {
    await service.create(WS, USER, {
      operation: 'describe',
      name: 'a',
      systemPrompt: 'x'.repeat(20),
      userTemplate: 'y'.repeat(20),
      isDefault: true,
    });
    const def = await service.getDefaultFor(WS, 'describe');
    expect(def?.name).toBe('a');
  });

  it('getDefaultFor returns null when no default exists', async () => {
    const def = await service.getDefaultFor(WS, 'describe');
    expect(def).toBeNull();
  });

  it('interpolate substitutes known {{vars}} and keeps unknown ones', () => {
    const out = service.interpolate('Title: {{taskTitle}}, missing: {{nope}}', {
      taskTitle: 'Hello',
    });
    expect(out).toBe('Title: Hello, missing: {{nope}}');
  });
});
