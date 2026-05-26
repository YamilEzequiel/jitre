import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from 'eventemitter2';
import { DomainEvent } from './domain-event.base';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  publish<E extends DomainEvent>(event: E): void {
    this.logger.debug({
      eventName: event.name,
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      workspaceId: event.workspaceId,
    });
    this.emitter.emit(event.name, event);
  }

  subscribe(
    eventName: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): () => void {
    const listener = (event: DomainEvent): void => {
      void handler(event);
    };
    this.emitter.on(eventName, listener);
    return () => this.emitter.off(eventName, listener);
  }
}
