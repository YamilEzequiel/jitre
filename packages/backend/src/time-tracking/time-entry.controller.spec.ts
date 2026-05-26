import { Test } from '@nestjs/testing';
import { WorkspaceRole } from '@jitre/shared';
import { TimeEntryController } from './time-entry.controller';
import { TimeEntryService } from './time-entry.service';
import { TimeReportGroupBy } from './dto/time-report.query.dto';

const mockService = {
  create: jest.fn(),
  list: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  startTimer: jest.fn(),
  stopActiveTimer: jest.fn(),
  getActiveTimer: jest.fn(),
  report: jest.fn(),
  summaryForTask: jest.fn(),
};

function makeReq(overrides: Record<string, unknown> = {}): unknown {
  return {
    user: { id: 'U1' },
    workspace: { id: 'W1', role: WorkspaceRole.MEMBER },
    ...overrides,
  };
}

function makeEntry(id = 'TE1'): Record<string, unknown> {
  return {
    id,
    workspaceId: 'W1',
    taskId: 'T1',
    userId: 'U1',
    durationMinutes: 30,
    date: new Date('2026-05-20'),
    description: null,
    billable: true,
    startedAt: null,
    stoppedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('TimeEntryController', () => {
  let controller: TimeEntryController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TimeEntryController],
      providers: [{ provide: TimeEntryService, useValue: mockService }],
    }).compile();

    controller = module.get(TimeEntryController);
  });

  describe('POST /time-entries', () => {
    it('forwards the create payload with the actor from the request', async () => {
      mockService.create.mockResolvedValueOnce(makeEntry());

      await controller.create(
        {
          taskId: 'T1',
          durationMinutes: 45,
          date: '2026-05-20',
          description: 'fixed bug',
          billable: false,
        },
        makeReq() as Parameters<typeof controller.create>[1],
      );

      expect(mockService.create).toHaveBeenCalledWith({
        workspaceId: 'W1',
        actorUserId: 'U1',
        taskId: 'T1',
        durationMinutes: 45,
        date: '2026-05-20',
        description: 'fixed bug',
        billable: false,
      });
    });
  });

  describe('GET /time-entries', () => {
    it('forwards filters and the caller’s role for visibility checks', async () => {
      mockService.list.mockResolvedValueOnce([]);

      await controller.list(
        {
          userId: 'U2',
          taskId: 'T1',
          projectId: 'P1',
          dateFrom: '2026-05-01',
          dateTo: '2026-05-31',
          billable: true,
        },
        makeReq({
          workspace: { id: 'W1', role: WorkspaceRole.ADMIN },
        }) as Parameters<typeof controller.list>[1],
      );

      expect(mockService.list).toHaveBeenCalledWith({
        workspaceId: 'W1',
        actorUserId: 'U1',
        actorRole: WorkspaceRole.ADMIN,
        userId: 'U2',
        taskId: 'T1',
        projectId: 'P1',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
        billable: true,
      });
    });
  });

  describe('Timer endpoints', () => {
    it('POST /time-entries/timer/start delegates to startTimer', async () => {
      mockService.startTimer.mockResolvedValueOnce(makeEntry('TE-T'));

      await controller.startTimer(
        { taskId: 'T1', description: 'starting', billable: true },
        makeReq() as Parameters<typeof controller.startTimer>[1],
      );

      expect(mockService.startTimer).toHaveBeenCalledWith({
        workspaceId: 'W1',
        actorUserId: 'U1',
        taskId: 'T1',
        description: 'starting',
        billable: true,
      });
    });

    it('POST /time-entries/timer/stop delegates to stopActiveTimer with workspace + actor', async () => {
      mockService.stopActiveTimer.mockResolvedValueOnce(makeEntry('TE-T'));

      await controller.stopTimer(
        makeReq() as Parameters<typeof controller.stopTimer>[0],
      );

      expect(mockService.stopActiveTimer).toHaveBeenCalledWith('W1', 'U1');
    });

    it('GET /time-entries/timer/active delegates to getActiveTimer', async () => {
      mockService.getActiveTimer.mockResolvedValueOnce(null);
      const result = await controller.getActiveTimer(
        makeReq() as Parameters<typeof controller.getActiveTimer>[0],
      );
      expect(mockService.getActiveTimer).toHaveBeenCalledWith('U1');
      expect(result).toBeNull();
    });
  });

  describe('GET /time-entries/report', () => {
    it('forwards the report query along with actor + role', async () => {
      mockService.report.mockResolvedValueOnce([]);

      await controller.report(
        {
          groupBy: TimeReportGroupBy.PROJECT,
          dateFrom: '2026-05-01',
          dateTo: '2026-05-31',
          projectId: 'P1',
        },
        makeReq({
          workspace: { id: 'W1', role: WorkspaceRole.ADMIN },
        }) as Parameters<typeof controller.report>[1],
      );

      expect(mockService.report).toHaveBeenCalledWith({
        workspaceId: 'W1',
        actorUserId: 'U1',
        actorRole: WorkspaceRole.ADMIN,
        groupBy: TimeReportGroupBy.PROJECT,
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
        userId: undefined,
        projectId: 'P1',
      });
    });
  });

  describe('PATCH /time-entries/:id', () => {
    it('forwards id, actor and role for ownership checks', async () => {
      mockService.update.mockResolvedValueOnce(makeEntry());

      await controller.update(
        'TE1',
        { durationMinutes: 90, billable: false },
        makeReq() as Parameters<typeof controller.update>[2],
      );

      expect(mockService.update).toHaveBeenCalledWith({
        id: 'TE1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        actorRole: WorkspaceRole.MEMBER,
        durationMinutes: 90,
        date: undefined,
        description: undefined,
        billable: false,
      });
    });
  });

  describe('DELETE /time-entries/:id', () => {
    it('forwards id + actor + role to service.delete', async () => {
      mockService.delete.mockResolvedValueOnce(undefined);

      await controller.remove(
        'TE1',
        makeReq({
          workspace: { id: 'W1', role: WorkspaceRole.ADMIN },
        }) as Parameters<typeof controller.remove>[1],
      );

      expect(mockService.delete).toHaveBeenCalledWith({
        id: 'TE1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        actorRole: WorkspaceRole.ADMIN,
      });
    });
  });

  describe('GET /tasks/:taskId/time-summary', () => {
    it('delegates to summaryForTask with caller role for entry visibility', async () => {
      mockService.summaryForTask.mockResolvedValueOnce({
        totalMinutes: 120,
        entries: [],
      });

      const result = await controller.taskSummary(
        'T1',
        makeReq() as Parameters<typeof controller.taskSummary>[1],
      );

      expect(mockService.summaryForTask).toHaveBeenCalledWith(
        'T1',
        'W1',
        'U1',
        WorkspaceRole.MEMBER,
      );
      expect((result as { totalMinutes: number }).totalMinutes).toBe(120);
    });
  });

  describe('GET /time-entries/:id', () => {
    it('delegates to service.getById', async () => {
      mockService.getById.mockResolvedValueOnce(makeEntry());

      await controller.findOne(
        'TE1',
        makeReq() as Parameters<typeof controller.findOne>[1],
      );

      expect(mockService.getById).toHaveBeenCalledWith('TE1', 'W1');
    });
  });
});
