import { DomainEvent } from '../domain-event.base';

export interface SessionCreatedPayload {
  sessionId: string;
  deviceInfo: Record<string, unknown>;
}

export class SessionCreatedEvent extends DomainEvent<SessionCreatedPayload> {
  static readonly aggregateType = 'Session';

  get name(): string {
    return 'session.created';
  }
}
