import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastContainerComponent } from './toast-container.component';
import { ToastService, Toast } from '../../core/toast/toast.service';
import { signal } from '@angular/core';

describe('ToastContainerComponent', () => {
  let fixture: ComponentFixture<ToastContainerComponent>;
  const toastsSignal = signal<Toast[]>([]);
  let dismissMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dismissMock = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ToastService,
          useValue: {
            toasts: toastsSignal.asReadonly(),
            dismiss: dismissMock,
          },
        },
      ],
    });

    fixture = TestBed.createComponent(ToastContainerComponent);
    toastsSignal.set([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders no toasts initially', () => {
    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="toast"]');
    expect(items.length).toBe(0);
  });

  it('renders success toast with role=status', () => {
    toastsSignal.set([{ id: '1', variant: 'success', message: 'Done!', ttl: 3000 }]);
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="toast"]') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.getAttribute('role')).toBe('status');
  });

  it('renders error toast with role=alert', () => {
    toastsSignal.set([{ id: '2', variant: 'error', message: 'Failed!', ttl: 5000 }]);
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="toast"]') as HTMLElement;
    expect(el.getAttribute('role')).toBe('alert');
  });

  it('clicking dismiss button calls ToastService.dismiss', () => {
    toastsSignal.set([{ id: '3', variant: 'info', message: 'Info', ttl: 3000 }]);
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="toast-dismiss"]') as HTMLButtonElement;
    btn.click();
    expect(dismissMock).toHaveBeenCalledWith('3');
  });
});
