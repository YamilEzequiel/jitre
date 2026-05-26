import { DomainEvent } from './domain-event.base';

class TestEvent extends DomainEvent<{ value: string }> {
  get name(): string {
    return 'test.event';
  }
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('DomainEvent', () => {
  let event: TestEvent;
  const before = new Date();

  beforeEach(() => {
    event = new TestEvent({
      aggregateId: 'agg-1',
      aggregateType: 'TestAggregate',
      workspaceId: 'ws-1',
      actorUserId: 'u-1',
      payload: { value: 'x' },
    });
  });

  it('eventId is a valid UUID v4', () => {
    expect(event.eventId).toMatch(UUID_V4_REGEX);
  });

  it('occurredAt is within 1s of now', () => {
    const after = new Date();
    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(
      after.getTime() + 1000,
    );
  });

  it('name getter returns the subclass value', () => {
    expect(event.name).toBe('test.event');
  });

  it('aggregateId is stored', () => {
    expect(event.aggregateId).toBe('agg-1');
  });

  it('aggregateType is stored', () => {
    expect(event.aggregateType).toBe('TestAggregate');
  });

  it('payload is stored', () => {
    expect(event.payload).toEqual({ value: 'x' });
  });

  it('two events have different eventIds', () => {
    const e2 = new TestEvent({
      aggregateId: 'agg-2',
      aggregateType: 'TestAggregate',
      payload: { value: 'y' },
    });
    expect(event.eventId).not.toBe(e2.eventId);
  });
});
