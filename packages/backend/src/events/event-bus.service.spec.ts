import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from 'eventemitter2';
import { EventBusService } from './event-bus.service';
import { DomainEvent } from './domain-event.base';

class FakeEvent extends DomainEvent<{ msg: string }> {
  get name() {
    return 'fake.event';
  }
}

const makeEvent = () =>
  new FakeEvent({
    aggregateId: 'a-1',
    aggregateType: 'Fake',
    workspaceId: 'ws-1',
    payload: { msg: 'hello' },
  });

describe('EventBusService', () => {
  let service: EventBusService;
  let emitter: EventEmitter2;

  beforeEach(async () => {
    emitter = new EventEmitter2({
      wildcard: true,
      delimiter: '.',
      maxListeners: 50,
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusService,
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();
    service = module.get(EventBusService);
  });

  afterEach(() => {
    emitter.removeAllListeners();
  });

  describe('publish', () => {
    it('dispatches to a subscriber registered via subscribe()', (done) => {
      service.subscribe('fake.event', (evt) => {
        expect(evt).toBeInstanceOf(FakeEvent);
        done();
        return Promise.resolve();
      });
      service.publish(makeEvent());
    });

    it('emits a debug log on publish', () => {
      const logSpy = jest.spyOn(service['logger'], 'debug');
      service.publish(makeEvent());
      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('returns an unsubscribe function that stops delivery', () => {
      const handler = jest.fn();
      const off = service.subscribe('fake.event', handler);
      off();
      service.publish(makeEvent());
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
