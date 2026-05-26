import { DomainEvent } from '../../events/domain-event.base';

export interface AiBudgetExceededPayload {
  spent: string;
  budget: number;
  currency: string;
}

export class AiBudgetExceededEvent extends DomainEvent<AiBudgetExceededPayload> {
  get name(): string {
    return 'ai.budget_exceeded';
  }
}
