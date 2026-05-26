import { AiRequestMadeEvent } from './ai-request-made.event';
import { AiRequestFailedEvent } from './ai-request-failed.event';
import { AiBudgetExceededEvent } from './ai-budget-exceeded.event';
import { AiRateLimitHitEvent } from './ai-rate-limit-hit.event';
import { AiProvider, AiOperation } from '@jitre/shared';

describe('AI domain events', () => {
  const workspaceId = 'workspace-uuid';
  const userId = 'user-uuid';

  describe('AiRequestMadeEvent', () => {
    it('has name ai.request_made', () => {
      const evt = new AiRequestMadeEvent({
        aggregateId: workspaceId,
        aggregateType: 'Workspace',
        workspaceId,
        actorUserId: userId,
        payload: {
          provider: AiProvider.GEMINI,
          model: 'gemini-2.0-flash-exp',
          operation: AiOperation.DESCRIBE,
          costUsd: '0.000100',
          totalTokens: 200,
        },
      });
      expect(evt.name).toBe('ai.request_made');
    });

    it('carries provider + model + operation + costUsd + totalTokens in payload', () => {
      const evt = new AiRequestMadeEvent({
        aggregateId: workspaceId,
        aggregateType: 'Workspace',
        workspaceId,
        actorUserId: userId,
        payload: {
          provider: AiProvider.GEMINI,
          model: 'gemini-2.0-flash-exp',
          operation: AiOperation.DESCRIBE,
          costUsd: '0.000100',
          totalTokens: 200,
        },
      });
      expect(evt.payload.provider).toBe(AiProvider.GEMINI);
      expect(evt.payload.model).toBe('gemini-2.0-flash-exp');
      expect(evt.payload.operation).toBe(AiOperation.DESCRIBE);
      expect(evt.payload.costUsd).toBe('0.000100');
      expect(evt.payload.totalTokens).toBe(200);
    });
  });

  describe('AiRequestFailedEvent', () => {
    it('has name ai.request_failed', () => {
      const evt = new AiRequestFailedEvent({
        aggregateId: workspaceId,
        aggregateType: 'Workspace',
        workspaceId,
        actorUserId: userId,
        payload: {
          provider: AiProvider.GEMINI,
          operation: AiOperation.DESCRIBE,
          errorCode: 'RATE_LIMITED',
          message: 'Too many requests',
        },
      });
      expect(evt.name).toBe('ai.request_failed');
    });

    it('carries errorCode in payload', () => {
      const evt = new AiRequestFailedEvent({
        aggregateId: workspaceId,
        aggregateType: 'Workspace',
        workspaceId,
        payload: {
          provider: AiProvider.GEMINI,
          operation: AiOperation.SUMMARY,
          errorCode: 'SAFETY_BLOCKED',
          message: 'Content blocked',
        },
      });
      expect(evt.payload.errorCode).toBe('SAFETY_BLOCKED');
    });
  });

  describe('AiBudgetExceededEvent', () => {
    it('has name ai.budget_exceeded', () => {
      const evt = new AiBudgetExceededEvent({
        aggregateId: workspaceId,
        aggregateType: 'Workspace',
        workspaceId,
        payload: { spent: '5.123456', budget: 5.0, currency: 'USD' },
      });
      expect(evt.name).toBe('ai.budget_exceeded');
    });

    it('carries spent + budget + currency in payload', () => {
      const evt = new AiBudgetExceededEvent({
        aggregateId: workspaceId,
        aggregateType: 'Workspace',
        workspaceId,
        payload: { spent: '5.000001', budget: 5.0, currency: 'USD' },
      });
      expect(evt.payload.spent).toBe('5.000001');
      expect(evt.payload.budget).toBe(5.0);
      expect(evt.payload.currency).toBe('USD');
    });
  });

  describe('AiRateLimitHitEvent', () => {
    it('has name ai.rate_limit_hit', () => {
      const evt = new AiRateLimitHitEvent({
        aggregateId: workspaceId,
        aggregateType: 'Workspace',
        workspaceId,
        actorUserId: userId,
        payload: {
          limitType: 'USER_DAILY_REQUESTS',
          current: 100,
          cap: 100,
        },
      });
      expect(evt.name).toBe('ai.rate_limit_hit');
    });

    it('carries limitType + current + cap in payload', () => {
      const evt = new AiRateLimitHitEvent({
        aggregateId: workspaceId,
        aggregateType: 'Workspace',
        workspaceId,
        payload: {
          limitType: 'WORKSPACE_DAILY_REQUESTS',
          current: 1000,
          cap: 1000,
        },
      });
      expect(evt.payload.limitType).toBe('WORKSPACE_DAILY_REQUESTS');
      expect(evt.payload.current).toBe(1000);
      expect(evt.payload.cap).toBe(1000);
    });
  });
});
