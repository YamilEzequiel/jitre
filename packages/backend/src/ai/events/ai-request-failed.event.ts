import { DomainEvent } from '../../events/domain-event.base';
import { AiProvider, AiOperation } from '@jitre/shared';

export interface AiRequestFailedPayload {
  provider: AiProvider;
  operation: AiOperation;
  errorCode: string;
  message: string;
}

export class AiRequestFailedEvent extends DomainEvent<AiRequestFailedPayload> {
  get name(): string {
    return 'ai.request_failed';
  }
}
