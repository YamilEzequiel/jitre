import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ToastService] });
    service = TestBed.inject(ToastService);
  });

  it('success pushes toast with correct variant and TTL', () => {
    service.success('Great!');
    const toasts = service.toasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0].variant).toBe('success');
    expect(toasts[0].message).toBe('Great!');
    expect(toasts[0].ttl).toBe(3000);
  });

  it('error pushes toast with 5s TTL', () => {
    service.error('Fail!');
    expect(service.toasts()[0].variant).toBe('error');
    expect(service.toasts()[0].ttl).toBe(5000);
  });

  it('info pushes toast with 3s TTL', () => {
    service.info('Info');
    expect(service.toasts()[0].variant).toBe('info');
    expect(service.toasts()[0].ttl).toBe(3000);
  });

  it('warning pushes toast with 4s TTL', () => {
    service.warning('Warn');
    expect(service.toasts()[0].variant).toBe('warning');
    expect(service.toasts()[0].ttl).toBe(4000);
  });

  it('auto-dismiss removes toast after TTL', () => {
    vi.useFakeTimers();
    service.success('Gone');
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(3001);
    expect(service.toasts().length).toBe(0);
    vi.useRealTimers();
  });

  it('dismiss by id removes only that toast', () => {
    service.success('Keep');
    service.error('Remove');
    const toasts = service.toasts();
    const idToRemove = toasts[1].id;
    service.dismiss(idToRemove);
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('Keep');
  });
});
