import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskPriority } from '@jitre/shared';
import { AiAutoPrioritizeService } from './ai-auto-prioritize.service';
import { AiPrioritySuggestionEntity } from './ai-priority-suggestion.entity';
import { TaskEntity } from '../../task/task.entity';
import { WorkspaceEntity } from '../../workspace/workspace.entity';

/**
 * Stub-based suite focused on the heuristic in `evaluate()` and the
 * "stale previous open suggestions" behaviour. We don't exercise
 * TypeORM relations — the service is plumbing over a deterministic
 * priority bump.
 */
describe('AiAutoPrioritizeService', () => {
  const WS = 'ws-1';

  function fakeRepos() {
    const suggestionsRows: AiPrioritySuggestionEntity[] = [];

    const suggRepo = {
      rows: suggestionsRows,
      find: jest.fn(async () => suggestionsRows.filter((r) => !r.deletedAt)),
      findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        suggestionsRows.find((r) => {
          for (const [k, v] of Object.entries(where)) {
            if (k === 'deletedAt') continue;
            if ((r as unknown as Record<string, unknown>)[k] !== v) return false;
          }
          return true;
        }),
      ),
      create: jest.fn((data: Partial<AiPrioritySuggestionEntity>) => ({ ...data })),
      save: jest.fn(async (data: AiPrioritySuggestionEntity) => {
        if (!data.id) {
          data.id = `s-${suggestionsRows.length + 1}`;
          suggestionsRows.push(data);
        } else {
          const idx = suggestionsRows.findIndex((s) => s.id === data.id);
          if (idx >= 0) suggestionsRows[idx] = data;
          else suggestionsRows.push(data);
        }
        return data;
      }),
      update: jest.fn(
        async (
          where: Record<string, unknown>,
          patch: Partial<AiPrioritySuggestionEntity>,
        ) => {
          let affected = 0;
          for (const r of suggestionsRows) {
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
    };

    const tasks: TaskEntity[] = [];
    const taskRepo = {
      rows: tasks,
      find: jest.fn(async () => tasks),
      update: jest.fn(async (_where: unknown, patch: Partial<TaskEntity>) => {
        for (const t of tasks) Object.assign(t, patch);
        return { affected: tasks.length };
      }),
    };

    const wsRepo = {
      find: jest.fn(async () => [{ id: WS } as WorkspaceEntity]),
    };

    return { suggRepo, taskRepo, wsRepo, suggestionsRows };
  }

  async function makeService(stubs: ReturnType<typeof fakeRepos>) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiAutoPrioritizeService,
        { provide: getRepositoryToken(AiPrioritySuggestionEntity), useValue: stubs.suggRepo },
        { provide: getRepositoryToken(TaskEntity), useValue: stubs.taskRepo },
        { provide: getRepositoryToken(WorkspaceEntity), useValue: stubs.wsRepo },
      ],
    }).compile();
    return moduleRef.get(AiAutoPrioritizeService);
  }

  function task(
    overrides: Partial<TaskEntity> & { dueDate?: Date | string | null },
  ): TaskEntity {
    return {
      id: 'task-1',
      workspaceId: WS,
      priority: TaskPriority.NONE,
      dueDate: null,
      completedAt: null,
      deletedAt: null,
      ...overrides,
    } as unknown as TaskEntity;
  }

  it('suggests URGENT for an overdue task with low priority', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const stubs = fakeRepos();
    stubs.taskRepo.rows.push(task({ priority: TaskPriority.LOW, dueDate: yesterday }));
    const service = await makeService(stubs);

    const res = await service.generateFor(WS);
    expect(res.created).toBe(1);
    expect(stubs.suggestionsRows[0].suggestedPriority).toBe(TaskPriority.URGENT);
    expect(stubs.suggestionsRows[0].reason).toMatch(/overdue/i);
  });

  it('suggests HIGH for a task due in 2 days with MEDIUM priority', async () => {
    const in2 = new Date();
    in2.setDate(in2.getDate() + 2);

    const stubs = fakeRepos();
    stubs.taskRepo.rows.push(task({ priority: TaskPriority.MEDIUM, dueDate: in2 }));
    const service = await makeService(stubs);

    await service.generateFor(WS);
    const open = stubs.suggestionsRows.filter((s) => s.status === 'open');
    expect(open[0].suggestedPriority).toBe(TaskPriority.HIGH);
  });

  it('suggests MEDIUM for a task due within a week with NONE priority', async () => {
    const in5 = new Date();
    in5.setDate(in5.getDate() + 5);

    const stubs = fakeRepos();
    stubs.taskRepo.rows.push(task({ priority: TaskPriority.NONE, dueDate: in5 }));
    const service = await makeService(stubs);

    await service.generateFor(WS);
    const open = stubs.suggestionsRows.filter((s) => s.status === 'open');
    expect(open[0].suggestedPriority).toBe(TaskPriority.MEDIUM);
  });

  it('does NOT suggest anything if the task is already above the threshold', async () => {
    const in2 = new Date();
    in2.setDate(in2.getDate() + 2);

    const stubs = fakeRepos();
    stubs.taskRepo.rows.push(task({ priority: TaskPriority.URGENT, dueDate: in2 }));
    const service = await makeService(stubs);

    const res = await service.generateFor(WS);
    expect(res.created).toBe(0);
  });

  it('marks previous open suggestions as stale before creating fresh ones', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const stubs = fakeRepos();
    // pre-existing open suggestion (should become stale)
    stubs.suggestionsRows.push({
      id: 'old-1',
      workspaceId: WS,
      taskId: 'task-old',
      currentPriority: TaskPriority.LOW,
      suggestedPriority: TaskPriority.HIGH,
      reason: '',
      status: 'open',
    } as unknown as AiPrioritySuggestionEntity);

    stubs.taskRepo.rows.push(task({ priority: TaskPriority.LOW, dueDate: yesterday }));
    const service = await makeService(stubs);

    await service.generateFor(WS);

    const old = stubs.suggestionsRows.find((s) => s.id === 'old-1');
    expect(old?.status).toBe('stale');
  });

  it('accept() updates the task priority and marks the suggestion accepted', async () => {
    const stubs = fakeRepos();
    stubs.suggestionsRows.push({
      id: 's-1',
      workspaceId: WS,
      taskId: 'task-1',
      currentPriority: TaskPriority.LOW,
      suggestedPriority: TaskPriority.HIGH,
      reason: '',
      status: 'open',
    } as unknown as AiPrioritySuggestionEntity);
    stubs.taskRepo.rows.push(task({ priority: TaskPriority.LOW }));

    const service = await makeService(stubs);
    await service.accept(WS, 's-1', 'user-1');

    expect(stubs.taskRepo.update).toHaveBeenCalled();
    expect(stubs.suggestionsRows[0].status).toBe('accepted');
  });

  it('dismiss() does not change task priority', async () => {
    const stubs = fakeRepos();
    stubs.suggestionsRows.push({
      id: 's-1',
      workspaceId: WS,
      taskId: 'task-1',
      currentPriority: TaskPriority.LOW,
      suggestedPriority: TaskPriority.HIGH,
      reason: '',
      status: 'open',
    } as unknown as AiPrioritySuggestionEntity);

    const service = await makeService(stubs);
    await service.dismiss(WS, 's-1', 'user-1');

    expect(stubs.taskRepo.update).not.toHaveBeenCalled();
    expect(stubs.suggestionsRows[0].status).toBe('dismissed');
  });
});
