import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AuditLogListener } from './audit-log.listener';
import { AuditLogService } from './audit-log.service';
import { RequestContextService } from '../request-context/request-context.service';
import { DomainEvent } from '../events/domain-event.base';
import { WorkspaceMemberAddedEvent } from '../events/events/workspace-member-added.event';
import { AuditAction, WorkspaceRole } from '@jitre/shared';

const mockAuditService = {
  append: jest.fn(),
};

const mockRequestContext = {
  getRequestId: jest.fn().mockReturnValue(null),
};

const makeMemberAddedEvent = () =>
  new WorkspaceMemberAddedEvent({
    aggregateId: 'm-1',
    aggregateType: 'WorkspaceMembership',
    workspaceId: 'ws-1',
    actorUserId: 'u-1',
    payload: { addedUserId: 'u-2', role: WorkspaceRole.MEMBER },
  });

describe('AuditLogListener', () => {
  let listener: AuditLogListener;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogListener,
        { provide: AuditLogService, useValue: mockAuditService },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();
    listener = module.get(AuditLogListener);
  });

  describe('handleEvent (catch-all)', () => {
    it('maps workspace.member.added to WORKSPACE_MEMBER_ADDED and calls append', async () => {
      mockAuditService.append.mockResolvedValue({});
      const event = makeMemberAddedEvent();

      await listener.handleEvent(event);

      expect(mockAuditService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.WORKSPACE_MEMBER_ADDED,
          subjectType: 'WorkspaceMembership',
          subjectId: 'm-1',
        }),
      );
    });

    it('scrubs sensitive payload before passing to append', async () => {
      class SensitiveEvent extends DomainEvent<{
        password: string;
        safe: string;
      }> {
        get name() {
          return 'workspace.created';
        }
      }
      const evt = new SensitiveEvent({
        aggregateId: 'a-1',
        aggregateType: 'Workspace',
        workspaceId: 'ws-1',
        payload: { password: 'secret', safe: 'visible' },
      });
      mockAuditService.append.mockResolvedValue({});

      await listener.handleEvent(evt);

      const callArg = mockAuditService.append.mock.calls[0][0] as {
        diff: Record<string, unknown>;
      };
      expect(callArg.diff['password']).toBe('[REDACTED]');
      expect(callArg.diff['safe']).toBe('visible');
    });

    it('swallows errors from AuditLogService and logs them', async () => {
      const logErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      mockAuditService.append.mockRejectedValue(new Error('DB down'));
      const event = makeMemberAddedEvent();

      await expect(listener.handleEvent(event)).resolves.toBeUndefined();
      expect(logErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('skips events without workspaceId', async () => {
      class NoWorkspaceEvent extends DomainEvent<Record<string, unknown>> {
        get name() {
          return 'user.registered';
        }
      }
      const evt = new NoWorkspaceEvent({
        aggregateId: 'u-1',
        aggregateType: 'User',
        payload: {},
      });

      await listener.handleEvent(evt);

      expect(mockAuditService.append).not.toHaveBeenCalled();
    });

    it('skips non-DomainEvent values', async () => {
      await listener.handleEvent({
        name: 'stray',
        workspaceId: 'ws',
      } as unknown as DomainEvent);
      expect(mockAuditService.append).not.toHaveBeenCalled();
    });

    it('skips events with unknown names (no mapping) and does not crash', async () => {
      class UnknownEvent extends DomainEvent<Record<string, unknown>> {
        get name() {
          return 'some.new.event';
        }
      }
      const evt = new UnknownEvent({
        aggregateId: 'x-1',
        aggregateType: 'X',
        workspaceId: 'ws-1',
        payload: {},
      });

      await expect(listener.handleEvent(evt)).resolves.toBeUndefined();
      expect(mockAuditService.append).not.toHaveBeenCalled();
    });
  });
});
