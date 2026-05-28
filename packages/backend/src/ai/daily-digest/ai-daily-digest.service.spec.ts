import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiDailyDigestService } from './ai-daily-digest.service';
import { AiDailyDigestEntity } from './ai-daily-digest.entity';
import { TaskEntity } from '../../task/task.entity';
import { Comment } from '../../comment/comment.entity';
import { TimeEntryEntity } from '../../time-tracking/time-entry.entity';
import { WorkspaceEntity } from '../../workspace/workspace.entity';
import { WorkspaceMembershipEntity } from '../../workspace/workspace-membership.entity';
import { AiService } from '../ai.service';
import { SettingsService } from '../../settings/settings.service';

describe('AiDailyDigestService', () => {
  const workspaceId = 'ws-1';

  function makeDigestRepo() {
    const rows: AiDailyDigestEntity[] = [];
    return {
      rows,
      findOne: jest.fn(async ({ where }: { where: Partial<AiDailyDigestEntity> }) =>
        rows.find((row) =>
          Object.entries(where).every(([key, value]) => row[key as keyof AiDailyDigestEntity] === value),
        ) ?? null,
      ),
      find: jest.fn(async () => rows),
      create: jest.fn((data: Partial<AiDailyDigestEntity>) => data),
      merge: jest.fn((existing: AiDailyDigestEntity, data: Partial<AiDailyDigestEntity>) => ({
        ...existing,
        ...data,
      })),
      save: jest.fn(async (data: Partial<AiDailyDigestEntity>) => {
        const entity = { id: (data.id as string | undefined) ?? `d-${rows.length + 1}`, ...data } as AiDailyDigestEntity;
        const idx = rows.findIndex((row) => row.id === entity.id);
        if (idx >= 0) rows[idx] = entity;
        else rows.push(entity);
        return entity;
      }),
    };
  }

  async function setup() {
    const digestRepo = makeDigestRepo();
    const ai = {
      generateCompletion: jest.fn(async () => ({ text: 'ok', model: 'gpt-test' })),
    };
    const settings = {
      getWorkspaceSetting: jest.fn(async () => 'en'),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AiDailyDigestService,
        { provide: getRepositoryToken(AiDailyDigestEntity), useValue: digestRepo },
        { provide: getRepositoryToken(TaskEntity), useValue: {} },
        { provide: getRepositoryToken(Comment), useValue: {} },
        { provide: getRepositoryToken(TimeEntryEntity), useValue: {} },
        { provide: getRepositoryToken(WorkspaceEntity), useValue: { find: jest.fn(async () => []) } },
        { provide: getRepositoryToken(WorkspaceMembershipEntity), useValue: {} },
        { provide: AiService, useValue: ai },
        { provide: SettingsService, useValue: settings },
      ],
    }).compile();

    return {
      service: moduleRef.get(AiDailyDigestService),
      digestRepo,
      ai,
      settings,
    };
  }

  it('requests the digest in Spanish when the workspace locale is es', async () => {
    const { service, ai, settings } = await setup();
    settings.getWorkspaceSetting.mockResolvedValue('es');
    jest.spyOn(service as never, 'collectActivity').mockResolvedValue({
      workspaceId,
      tasksCreated: 3,
      tasksCompleted: 2,
      commentsPosted: 5,
      timeLoggedMinutes: 90,
      topAssignees: [{ userId: 'user-12345678', tasks: 4 }],
    } as never);

    await service.generateFor(workspaceId, '2026-05-27');

    expect(ai.generateCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          systemPrompt: expect.stringContaining('Produce el resumen en español'),
          userPrompt: expect.stringContaining('Escribí el resumen en markdown en español.'),
        }),
      }),
    );
  });

  it('stores the empty-day fallback in Spanish when the workspace locale is es', async () => {
    const { service, settings } = await setup();
    settings.getWorkspaceSetting.mockResolvedValue('es');
    jest.spyOn(service as never, 'collectActivity').mockResolvedValue({
      workspaceId,
      tasksCreated: 0,
      tasksCompleted: 0,
      commentsPosted: 0,
      timeLoggedMinutes: 0,
      topAssignees: [],
    } as never);

    const result = await service.generateFor(workspaceId, '2026-05-27');

    expect(result.summary).toBe('_(No hubo actividad para resumir en este día.)_');
  });
});
