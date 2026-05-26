import { Injectable, inject } from '@angular/core';
import { ToastService } from '../toast/toast.service';

export interface OptimisticRunOptions<T = void> {
  id: string;
  /** Apply optimistic mutation immediately; return rollback closure */
  apply: () => () => void;
  /** The real API call */
  apiCall: () => Promise<T>;
  /** Optional custom rollback toast message */
  rollbackToast?: string;
}

@Injectable({ providedIn: 'root' })
export class OptimisticUpdateService {
  private readonly toast = inject(ToastService);
  private readonly _pending = new Map<string, true>();

  async run<T = void>(options: OptimisticRunOptions<T>): Promise<T | undefined> {
    const { id, apply, apiCall, rollbackToast } = options;
    const rollback = apply();
    this._pending.set(id, true);
    try {
      const result = await apiCall();
      return result;
    } catch (error) {
      rollback();
      this.toast.error(rollbackToast ?? 'Action failed. Changes reverted.');
      return undefined;
    } finally {
      this._pending.delete(id);
    }
  }

  isPending(id: string): boolean {
    return this._pending.has(id);
  }
}
