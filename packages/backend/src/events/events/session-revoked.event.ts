import { DomainEvent } from '../domain-event.base';

export interface SessionRevokedPayload {
  sessionId: string;
  reason: 'logout' | 'logout-all' | 'admin';
}

export class SessionRevokedEvent extends DomainEvent<SessionRevokedPayload> {
  static readonly aggregateType = 'Session';

  get name(): string {
    return 'session.revoked';
  }
}
