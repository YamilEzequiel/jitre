import { DomainEvent } from '../domain-event.base';

export interface UserDisabledPayload {
  reason?: string;
}

export class UserDisabledEvent extends DomainEvent<UserDisabledPayload> {
  static readonly aggregateType = 'User';

  get name(): string {
    return 'user.disabled';
  }
}
