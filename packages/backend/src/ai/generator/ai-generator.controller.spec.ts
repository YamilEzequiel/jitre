import { Test } from '@nestjs/testing';
import { AiGeneratorController } from './ai-generator.controller';
import { AiGeneratorService } from './ai-generator.service';
import { AiQuotaGuard } from '../ai-quota.guard';
import { AbilityGuard } from '../../auth/guards/ability.guard';
import { RequestContextService } from '../../request-context/request-context.service';

const generatorMock = {
  draft: jest.fn(),
  commit: jest.fn(),
};

const requestContextMock = {
  getWorkspaceId: jest.fn().mockReturnValue('W1'),
  getUserId: jest.fn().mockReturnValue('U1'),
  getRole: jest.fn().mockReturnValue('MEMBER'),
};

describe('AiGeneratorController', () => {
  let controller: AiGeneratorController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [AiGeneratorController],
      providers: [
        { provide: AiGeneratorService, useValue: generatorMock },
        { provide: RequestContextService, useValue: requestContextMock },
      ],
    })
      .overrideGuard(AiQuotaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AbilityGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AiGeneratorController);
  });

  describe('POST /ai/generate/draft', () => {
    it('forwards prompt and resolved workspace/user to the service', async () => {
      generatorMock.draft.mockResolvedValueOnce({
        drafts: [{ kind: 'task', title: 'X' }],
        model: 'm',
        costUsd: '0',
      });

      const result = await controller.draft({
        prompt: 'build the thing',
        context: { projectId: 'P1' },
      });

      expect(generatorMock.draft).toHaveBeenCalledWith({
        workspaceId: 'W1',
        userId: 'U1',
        prompt: 'build the thing',
        projectId: 'P1',
      });
      expect(result.drafts).toHaveLength(1);
    });
  });

  describe('POST /ai/generate/commit', () => {
    it('forwards the draft (post-edit) to the service', async () => {
      generatorMock.commit.mockResolvedValueOnce({ kind: 'task', id: 'T-NEW' });

      const draft = { kind: 'task' as const, title: 'X', projectId: 'P1' };
      const result = await controller.commit({ draft });

      expect(generatorMock.commit).toHaveBeenCalledWith({
        workspaceId: 'W1',
        userId: 'U1',
        isWorkspaceAdmin: false,
        draft,
      });
      expect(result.id).toBe('T-NEW');
    });
  });
});
