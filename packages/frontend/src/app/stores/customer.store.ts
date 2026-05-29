import { Injectable, computed, inject, signal } from '@angular/core';
import { Customer, CustomerApiService } from './customer-api.service';

/**
 * Workspace-scoped signal cache for customers. Mirrors {@link AreaStore} so
 * any feature needing the customer list (projects, dashboard widgets) can
 * subscribe once and let computed signals propagate changes.
 */
@Injectable({ providedIn: 'root' })
export class CustomerStore {
  private readonly api = inject(CustomerApiService);

  readonly customers = signal<Customer[]>([]);
  readonly loading = signal(false);

  readonly byId = computed<Record<string, Customer>>(() => {
    const map: Record<string, Customer> = {};
    for (const c of this.customers()) map[c.id] = c;
    return map;
  });

  /** Customers in `active` status, ordered as the backend returned them. */
  readonly active = computed<Customer[]>(() =>
    this.customers().filter((c) => c.status === 'active'),
  );

  async load(workspaceId: string): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.api.list(workspaceId);
      this.customers.set(list);
    } finally {
      this.loading.set(false);
    }
  }

  upsert(customer: Customer): void {
    this.customers.update((list) => {
      const idx = list.findIndex((c) => c.id === customer.id);
      if (idx === -1) return [...list, customer];
      const next = list.slice();
      next[idx] = customer;
      return next;
    });
  }

  remove(id: string): void {
    this.customers.update((list) => list.filter((c) => c.id !== id));
  }

  clear(): void {
    this.customers.set([]);
  }
}
