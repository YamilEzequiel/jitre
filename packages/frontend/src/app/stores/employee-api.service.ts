import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Employee = a workspace member with optional profile fields. Backed by the
 * `users` table on the backend, served under `/api/v1/employees` with the
 * current workspace scoped via the `x-workspace-id` header.
 */
export interface Employee {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  workspaceRole: 'owner' | 'admin' | 'member' | 'guest';
  phone: string | null;
  position: string | null;
  department: string | null;
  hireDate: string | null;
  birthDate: string | null;
  address: string | null;
  bio: string | null;
  employeeCode: string | null;
  emergencyContact: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateEmployeeBody {
  displayName?: string;
  email?: string;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  hireDate?: string | null;
  birthDate?: string | null;
  address?: string | null;
  bio?: string | null;
  employeeCode?: string | null;
  emergencyContact?: string | null;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class EmployeeApiService {
  private readonly http = inject(HttpClient);

  list(): Promise<Employee[]> {
    return firstValueFrom(this.http.get<Employee[]>('/api/v1/employees'));
  }

  getById(id: string): Promise<Employee> {
    return firstValueFrom(this.http.get<Employee>(`/api/v1/employees/${id}`));
  }

  update(id: string, body: UpdateEmployeeBody): Promise<Employee> {
    return firstValueFrom(
      this.http.patch<Employee>(`/api/v1/employees/${id}`, body),
    );
  }

  uploadAvatar(id: string, file: File): Promise<unknown> {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(
      this.http.post(`/api/v1/employees/${id}/avatar`, form),
    );
  }
}
