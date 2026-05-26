import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  ttl: number;
}

const TTL_MAP: Record<ToastVariant, number> = {
  success: 3000,
  error: 5000,
  info: 3000,
  warning: 4000,
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private push(variant: ToastVariant, message: string): void {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    const ttl = TTL_MAP[variant];
    this._toasts.update(ts => [...ts, { id, variant, message, ttl }]);
    setTimeout(() => this.dismiss(id), ttl);
  }

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  warning(message: string): void {
    this.push('warning', message);
  }

  dismiss(id: string): void {
    this._toasts.update(ts => ts.filter(t => t.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
  }
}
