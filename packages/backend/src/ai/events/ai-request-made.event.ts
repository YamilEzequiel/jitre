import { DomainEvent } from '../../events/domain-event.base';
import { AiProvider, AiOperation } from '@jitre/shared';

export interface AiRequestMadePayload {
  provider: AiProvider;
  model: string;
  operation: AiOperation;
  costUsd: string;
  totalTokens: number;
}

export class AiRequestMadeEvent extends DomainEvent<AiRequestMadePayload> {
  get name(): string {
    return 'ai.request_made';
  }
}
