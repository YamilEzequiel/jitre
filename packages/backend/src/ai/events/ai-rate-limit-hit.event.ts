import { DomainEvent } from '../../events/domain-event.base';

export interface AiRateLimitHitPayload {
  limitType: 'USER_DAILY_REQUESTS' | 'WORKSPACE_DAILY_REQUESTS';
  current: number;
  cap: number;
}

export class AiRateLimitHitEvent extends DomainEvent<AiRateLimitHitPayload> {
  get name(): string {
    return 'ai.rate_limit_hit';
  }
}
