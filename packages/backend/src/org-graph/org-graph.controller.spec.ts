import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole } from '@jitre/shared';
import { OrgGraphController } from './org-graph.controller';
import { OrgGraphService } from './org-graph.service';

const mockService = {
  getOrgGraph: jest.fn(),
  addReport: jest.fn(),
  removeReport: jest.fn(),
};

function makeReq(overrides: Record<string, unknown> = {}): unknown {
  return {
    user: { id: 'U-ADMIN' },
    workspace: { id: 'W1', role: WorkspaceRole.ADMIN },
    ...overrides,
  };
}

describe('OrgGraphController', () => {
  let controller: OrgGraphController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [OrgGraphController],
      providers: [{ provide: OrgGraphService, useValue: mockService }],
    }).compile();
    controller = module.get(OrgGraphController);
  });

  describe('getOrgGraph() — GET /workspaces/:id/org-graph', () => {
    it('delegates to service when workspace matches', async () => {
      const graph = { nodes: [], edges: [] };
      mockService.getOrgGraph.mockResolvedValueOnce(graph);

      const result = await controller.getOrgGraph(
        'W1',
        makeReq() as Parameters<typeof controller.getOrgGraph>[1],
      );

      expect(mockService.getOrgGraph).toHaveBeenCalledWith('W1');
      expect(result).toBe(graph);
    });

    it('throws ForbiddenException when path id does not match req.workspace.id', async () => {
      await expect(
        controller.getOrgGraph(
          'W-OTHER',
          makeReq() as Parameters<typeof controller.getOrgGraph>[1],
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockService.getOrgGraph).not.toHaveBeenCalled();
    });
  });

  describe('addReport() — POST /workspaces/:id/reports', () => {
    it('delegates to service with workspace, user, supervisor and actor', async () => {
      const created = { id: 'R1' };
      mockService.addReport.mockResolvedValueOnce(created);

      const result = await controller.addReport(
        'W1',
        { userId: 'U1', supervisorId: 'U2' },
        makeReq() as Parameters<typeof controller.addReport>[2],
      );

      expect(mockService.addReport).toHaveBeenCalledWith(
        'W1',
        'U1',
        'U2',
        'U-ADMIN',
      );
      expect(result).toBe(created);
    });

    it('throws ForbiddenException on workspace mismatch', async () => {
      await expect(
        controller.addReport(
          'W-OTHER',
          { userId: 'U1', supervisorId: 'U2' },
          makeReq() as Parameters<typeof controller.addReport>[2],
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockService.addReport).not.toHaveBeenCalled();
    });
  });

  describe('removeReport() — DELETE /workspaces/:id/reports/:userId/supervisor/:supervisorId', () => {
    it('delegates to service.removeReport', async () => {
      mockService.removeReport.mockResolvedValueOnce(undefined);

      await controller.removeReport(
        'W1',
        'U1',
        'U2',
        makeReq() as Parameters<typeof controller.removeReport>[3],
      );

      expect(mockService.removeReport).toHaveBeenCalledWith('W1', 'U1', 'U2');
    });

    it('throws ForbiddenException on workspace mismatch', async () => {
      await expect(
        controller.removeReport(
          'W-OTHER',
          'U1',
          'U2',
          makeReq() as Parameters<typeof controller.removeReport>[3],
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockService.removeReport).not.toHaveBeenCalled();
    });
  });
});
