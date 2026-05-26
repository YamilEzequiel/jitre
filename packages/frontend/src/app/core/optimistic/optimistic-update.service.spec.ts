import { TestBed } from '@angular/core/testing';
import { OptimisticUpdateService } from './optimistic-update.service';
import { ToastService } from '../toast/toast.service';

describe('OptimisticUpdateService', () => {
  let service: OptimisticUpdateService;
  let toastService: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toastService = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        OptimisticUpdateService,
        { provide: ToastService, useValue: toastService },
      ],
    });
    service = TestBed.inject(OptimisticUpdateService);
  });

  it('apply function runs first before API call', async () => {
    const order: string[] = [];
    const apply = vi.fn(() => { order.push('apply'); return () => {}; });
    const apiCall = vi.fn(async () => { order.push('api'); });
    await service.run({ id: '1', apply, apiCall });
    expect(order[0]).toBe('apply');
    expect(order[1]).toBe('api');
  });

  it('success path — apply runs, rollback not called', async () => {
    const rollback = vi.fn();
    const apply = vi.fn(() => rollback);
    await service.run({ id: '2', apply, apiCall: async () => {} });
    expect(rollback).not.toHaveBeenCalled();
  });

  it('error path — rollback closure is invoked and toast shown', async () => {
    const rollback = vi.fn();
    const apply = vi.fn(() => rollback);
    const apiCall = vi.fn(async () => { throw new Error('API error'); });
    await service.run({ id: '3', apply, apiCall });
    expect(rollback).toHaveBeenCalled();
    expect(toastService.error).toHaveBeenCalled();
  });

  it('rollback closure is isolated per call', async () => {
    const rollback1 = vi.fn();
    const rollback2 = vi.fn();
    const apply1 = vi.fn(() => rollback1);
    const apply2 = vi.fn(() => rollback2);
    const failingApi = vi.fn(async () => { throw new Error('fail'); });

    await service.run({ id: 'a', apply: apply1, apiCall: failingApi });
    await service.run({ id: 'b', apply: apply2, apiCall: async () => {} });

    expect(rollback1).toHaveBeenCalled();
    expect(rollback2).not.toHaveBeenCalled();
  });

  it('isPending returns true while API call is in-flight, false after', async () => {
    let resolveFn!: () => void;
    const apiCall = () => new Promise<void>(resolve => { resolveFn = resolve; });
    const apply = vi.fn(() => () => {});
    const runPromise = service.run({ id: 'pending-id', apply, apiCall });
    expect(service.isPending('pending-id')).toBe(true);
    resolveFn();
    await runPromise;
    expect(service.isPending('pending-id')).toBe(false);
  });
});
