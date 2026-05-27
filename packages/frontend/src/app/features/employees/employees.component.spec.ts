import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { EmployeesComponent } from './employees.component';
import { EmployeeApiService, Employee } from '../../stores/employee-api.service';
import { OrgGraphApiService } from '../../stores/org-graph-api.service';
import { AreaStore } from '../../stores/area.store';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';

const baseEmployee = (overrides: Partial<Employee> = {}): Employee =>
  ({
    id: 'u1',
    email: 'alice@test.com',
    displayName: 'Alice',
    avatarUrl: null,
    status: 'active',
    workspaceRole: 'member',
    phone: null,
    position: null,
    department: null,
    hireDate: null,
    birthDate: null,
    address: null,
    bio: null,
    employeeCode: null,
    emergencyContact: null,
    areaId: null,
    lastLoginAt: null,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  } as Employee);

const ownerEmp = baseEmployee({ id: 'u-owner', displayName: 'Olivia', workspaceRole: 'owner' });
const adminEmp = baseEmployee({ id: 'u-admin', displayName: 'Andy', workspaceRole: 'admin' });
const memberEmp = baseEmployee({ id: 'u-self', displayName: 'Self User', workspaceRole: 'member' });

/**
 * Minimal `AreaStore` stand-in — the directory view reads the cache but
 * tests don't exercise area state, so a static empty signal is enough.
 */
const buildAreaStoreMock = () => {
  const areas = signal<unknown[]>([]);
  return {
    areas: areas.asReadonly(),
    loading: signal(false).asReadonly(),
    byId: signal({} as Record<string, unknown>).asReadonly(),
    load: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  };
};

describe('EmployeesComponent', () => {
  let fixture: ComponentFixture<EmployeesComponent>;
  let apiMock: {
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    uploadAvatar: ReturnType<typeof vi.fn>;
    updateRole: ReturnType<typeof vi.fn>;
  };
  let orgGraphApiMock: {
    getOrgGraph: ReturnType<typeof vi.fn>;
    addReport: ReturnType<typeof vi.fn>;
    removeReport: ReturnType<typeof vi.fn>;
  };
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const configure = (currentUserRole: 'admin' | 'member' = 'admin'): void => {
    apiMock = {
      list: vi.fn().mockResolvedValue([ownerEmp, adminEmp, memberEmp]),
      update: vi.fn(),
      uploadAvatar: vi.fn(),
      updateRole: vi.fn().mockResolvedValue({}),
    };
    orgGraphApiMock = {
      getOrgGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
      addReport: vi.fn().mockResolvedValue(undefined),
      removeReport: vi.fn().mockResolvedValue(undefined),
    };
    toastMock = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeeApiService, useValue: apiMock },
        { provide: OrgGraphApiService, useValue: orgGraphApiMock },
        { provide: AreaStore, useValue: buildAreaStoreMock() },
        { provide: ToastService, useValue: toastMock },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({
              id: 'u-self',
              email: 'self@test.com',
              displayName: 'Self User',
              role: currentUserRole,
            }).asReadonly(),
            currentWorkspace: signal({
              id: 'ws-1',
              name: 'WS',
              slug: 'ws',
              role: 'owner',
            }).asReadonly(),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(EmployeesComponent);
  };

  afterEach(() => TestBed.resetTestingModule());

  it('renders role badges with the correct labels and icons', async () => {
    configure('admin');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Owner');
    expect(text).toContain('Admin');
    expect(text).toContain('Member');
    // crown emoji for the owner row
    expect(text).toContain('👑');
  });

  it('exposes the edit-role affordance only for other rows when the user can manage', () => {
    configure('admin');
    const c = fixture.componentInstance;
    expect(c.canEditRoleOf(ownerEmp)).toBe(true);
    expect(c.canEditRoleOf(adminEmp)).toBe(true);
    // current user (memberEmp.id === 'u-self') must not be editable from the row
    expect(c.canEditRoleOf(memberEmp)).toBe(false);
  });

  it('hides the edit-role affordance entirely when the user cannot manage', () => {
    configure('member');
    const c = fixture.componentInstance;
    expect(c.canEditRoleOf(ownerEmp)).toBe(false);
    expect(c.canEditRoleOf(adminEmp)).toBe(false);
    expect(c.canEditRoleOf(memberEmp)).toBe(false);
  });

  it('startEditRole is a no-op when the row is the current user', () => {
    configure('admin');
    const c = fixture.componentInstance;
    c.startEditRole(memberEmp);
    expect(c.editingRoleFor()).toBeNull();
  });

  it('startEditRole switches the row into select mode for managed rows', () => {
    configure('admin');
    const c = fixture.componentInstance;
    c.startEditRole(adminEmp);
    expect(c.editingRoleFor()).toBe(adminEmp.id);
  });

  it('onRoleChange calls the API, updates the list and toasts success', async () => {
    configure('admin');
    fixture.detectChanges();
    await fixture.whenStable();

    const c = fixture.componentInstance;
    c.employees.set([ownerEmp, adminEmp, memberEmp]);

    await c.onRoleChange(adminEmp, 'member');

    expect(apiMock.updateRole).toHaveBeenCalledWith('ws-1', 'u-admin', 'member');
    expect(toastMock.success).toHaveBeenCalled();
    const updated = c.employees().find((e) => e.id === 'u-admin');
    expect(updated?.workspaceRole).toBe('member');
    expect(c.editingRoleFor()).toBeNull();
  });

  it('onRoleChange surfaces backend error detail via toast.error', async () => {
    configure('admin');
    fixture.detectChanges();
    await fixture.whenStable();

    const c = fixture.componentInstance;
    apiMock.updateRole.mockRejectedValueOnce({ error: { detail: 'LAST_OWNER' } });
    await c.onRoleChange(ownerEmp, 'member');

    expect(toastMock.error).toHaveBeenCalledWith('LAST_OWNER');
  });

  it('onRoleChange short-circuits when the new role equals the current one', async () => {
    configure('admin');
    const c = fixture.componentInstance;
    await c.onRoleChange(adminEmp, 'admin');
    expect(apiMock.updateRole).not.toHaveBeenCalled();
  });

  it('open() snapshots the supervisor list and the multi-select picks them up', async () => {
    orgGraphApiMock = {
      getOrgGraph: vi.fn().mockResolvedValue({
        nodes: [],
        edges: [{ from: memberEmp.id, to: adminEmp.id }],
      }),
      addReport: vi.fn().mockResolvedValue(undefined),
      removeReport: vi.fn().mockResolvedValue(undefined),
    };
    // Re-configure WITH the mock that already has an edge.
    apiMock = {
      list: vi.fn().mockResolvedValue([ownerEmp, adminEmp, memberEmp]),
      update: vi.fn().mockResolvedValue(memberEmp),
      uploadAvatar: vi.fn(),
      updateRole: vi.fn().mockResolvedValue({}),
    };
    toastMock = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeeApiService, useValue: apiMock },
        { provide: OrgGraphApiService, useValue: orgGraphApiMock },
        { provide: AreaStore, useValue: buildAreaStoreMock() },
        { provide: ToastService, useValue: toastMock },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({
              id: 'u-self',
              email: 'self@test.com',
              displayName: 'Self User',
              role: 'admin',
            }).asReadonly(),
            currentWorkspace: signal({
              id: 'ws-1',
              name: 'WS',
              slug: 'ws',
              role: 'owner',
            }).asReadonly(),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(EmployeesComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const c = fixture.componentInstance;
    c.open(memberEmp);
    expect(c.reportsTo()).toEqual([adminEmp.id]);
  });

  it('save() computes the supervisor diff and calls addReport/removeReport accordingly', async () => {
    // Start with edge member → admin. After save the user picks owner instead.
    orgGraphApiMock = {
      getOrgGraph: vi.fn().mockResolvedValue({
        nodes: [],
        edges: [{ from: memberEmp.id, to: adminEmp.id }],
      }),
      addReport: vi.fn().mockResolvedValue(undefined),
      removeReport: vi.fn().mockResolvedValue(undefined),
    };
    apiMock = {
      list: vi.fn().mockResolvedValue([ownerEmp, adminEmp, memberEmp]),
      update: vi.fn().mockResolvedValue(memberEmp),
      uploadAvatar: vi.fn(),
      updateRole: vi.fn().mockResolvedValue({}),
    };
    toastMock = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeeApiService, useValue: apiMock },
        { provide: OrgGraphApiService, useValue: orgGraphApiMock },
        { provide: AreaStore, useValue: buildAreaStoreMock() },
        { provide: ToastService, useValue: toastMock },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({
              id: 'u-self',
              email: 'self@test.com',
              displayName: 'Self User',
              role: 'admin',
            }).asReadonly(),
            currentWorkspace: signal({
              id: 'ws-1',
              name: 'WS',
              slug: 'ws',
              role: 'owner',
            }).asReadonly(),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(EmployeesComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const c = fixture.componentInstance;
    c.open(memberEmp);
    // Swap: drop admin, add owner.
    c.reportsTo.set([ownerEmp.id]);

    await c.save(memberEmp);

    expect(orgGraphApiMock.addReport).toHaveBeenCalledWith(
      'ws-1',
      memberEmp.id,
      ownerEmp.id,
    );
    expect(orgGraphApiMock.removeReport).toHaveBeenCalledWith(
      'ws-1',
      memberEmp.id,
      adminEmp.id,
    );
  });

  it('supervisorOptions excludes the employee being edited', () => {
    configure('admin');
    const c = fixture.componentInstance;
    c.employees.set([ownerEmp, adminEmp, memberEmp]);
    const opts = c.supervisorOptions(memberEmp.id);
    expect(opts.find((o) => o.value === memberEmp.id)).toBeUndefined();
    expect(opts.length).toBe(2);
  });
});
