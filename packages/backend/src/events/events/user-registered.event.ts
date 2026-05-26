import { DomainEvent } from '../domain-event.base';

export interface UserRegisteredPayload {
  email: string;
  displayName: string;
}

export class UserRegisteredEvent extends DomainEvent<UserRegisteredPayload> {
  static readonly aggregateType = 'User';

  get name(): string {
    return 'user.registered';
  }
}
