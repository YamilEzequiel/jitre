import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditLogService } from './audit-log.service';
import { RequestContextService } from '../request-context/request-context.service';
import { WorkspaceRole } from '@jitre/shared';

const mockAuditService = {
  findByWorkspace: jest.fn(),
  findBySubject: jest.fn(),
};

const mockRequestContext = {
  getWorkspaceId: jest.fn().mockReturnValue('ws-1'),
  getRole: jest.fn().mockReturnValue(WorkspaceRole.ADMIN),
};

const makePage = (items: unknown[] = []) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
});

describe('AuditController', () => {
  let controller: AuditController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        { provide: AuditLogService, useValue: mockAuditService },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();
    controller = module.get(AuditController);
  });

  describe('list', () => {
    it('ADMIN gets 200 with workspace audit logs', async () => {
      const page = makePage([{ id: 'r1' }, { id: 'r2' }]);
      mockAuditService.findByWorkspace.mockResolvedValue(page);

      const result = await controller.list({ page: 1, pageSize: 20 });

      expect(mockAuditService.findByWorkspace).toHaveBeenCalledWith('ws-1', {
        page: 1,
        pageSize: 20,
      });
      expect(result).toEqual(page);
    });
  });

  describe('listBySubject', () => {
    it('returns subject-filtered audit logs', async () => {
      const page = makePage([{ id: 'r1' }]);
      mockAuditService.findBySubject.mockResolvedValue(page);

      const result = await controller.listBySubject('User', 'sub-1', {
        page: 1,
        pageSize: 10,
      });

      expect(mockAuditService.findBySubject).toHaveBeenCalledWith(
        'ws-1',
        'User',
        'sub-1',
        { page: 1, pageSize: 10 },
      );
      expect(result).toEqual(page);
    });
  });
});
