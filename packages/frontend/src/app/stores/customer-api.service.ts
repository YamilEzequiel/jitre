import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Customer = workspace-scoped client / account that projects can be
 * attributed to. Replaces the legacy free-text `Project.customerName`
 * column — see migration `1700000003100-AddCustomers.ts`.
 */
export interface Customer {
  id: string;
  workspaceId: string;
  name: string;
  status: 'active' | 'archived';
  /** Hex color (e.g. `#2563eb`). */
  color: string;
  /**
   * Either a primeicon name like `pi-building` OR a short emoji like
   * `🏢`. Renderers should detect the `pi-` prefix and emit an `<i>` tag
   * accordingly; otherwise render the string as text/emoji.
   */
  icon: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCustomerBody {
  name: string;
  color?: string;
  icon?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface UpdateCustomerBody {
  name?: string;
  status?: 'active' | 'archived';
  color?: string;
  icon?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address?: string | null;
  notes?: string | null;
}

/**
 * Thin client over the workspace-scoped customer endpoints. Mirrors
 * {@link AreaApiService} so callers can simply `await` results.
 */
@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  private readonly http = inject(HttpClient);

  list(workspaceId: string): Promise<Customer[]> {
    return firstValueFrom(
      this.http.get<Customer[]>(`/api/v1/workspaces/${workspaceId}/customers`),
    );
  }

  get(workspaceId: string, id: string): Promise<Customer> {
    return firstValueFrom(
      this.http.get<Customer>(
        `/api/v1/workspaces/${workspaceId}/customers/${id}`,
      ),
    );
  }

  create(workspaceId: string, dto: CreateCustomerBody): Promise<Customer> {
    return firstValueFrom(
      this.http.post<Customer>(
        `/api/v1/workspaces/${workspaceId}/customers`,
        dto,
      ),
    );
  }

  update(
    workspaceId: string,
    id: string,
    dto: UpdateCustomerBody,
  ): Promise<Customer> {
    return firstValueFrom(
      this.http.patch<Customer>(
        `/api/v1/workspaces/${workspaceId}/customers/${id}`,
        dto,
      ),
    );
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`/api/v1/workspaces/${workspaceId}/customers/${id}`),
    );
  }
}
