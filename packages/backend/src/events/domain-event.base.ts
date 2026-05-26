import { randomUUID } from 'node:crypto';

export interface DomainEventOpts<P> {
  eventId?: string;
  aggregateId: string;
  aggregateType: string;
  actorUserId?: string;
  workspaceId?: string;
  payload: P;
}

export abstract class DomainEvent<P = unknown> {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly actorUserId?: string;
  readonly workspaceId?: string;
  readonly payload: P;

  abstract get name(): string;

  constructor(opts: DomainEventOpts<P>) {
    this.eventId = opts.eventId ?? randomUUID();
    this.occurredAt = new Date();
    this.aggregateId = opts.aggregateId;
    this.aggregateType = opts.aggregateType;
    this.actorUserId = opts.actorUserId;
    this.workspaceId = opts.workspaceId;
    this.payload = opts.payload;
  }
}
