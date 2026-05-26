import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectMembersComponent } from './project-members.component';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../core/toast/toast.service';
import { AuthService } from '../../../core/auth/auth.service';
import { signal } from '@angular/core';

const mockMembers = [
  { id: 'm1', userId: 'u1', displayName: 'Alice', email: 'alice@test.com', avatarUrl: null, role: 'admin' as const },
  { id: 'm2', userId: 'u2', displayName: 'Bob', email: 'bob@test.com', avatarUrl: null, role: 'contributor' as const },
];

describe('ProjectMembersComponent', () => {
  let fixture: ComponentFixture<ProjectMembersComponent>;
  let httpMock: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpMock = {
      get: vi.fn().mockReturnValue({ subscribe: (obs: any) => obs.next(mockMembers) }),
      post: vi.fn().mockReturnValue({ subscribe: (obs: any) => obs.next({}) }),
      delete: vi.fn().mockReturnValue({ subscribe: (obs: any) => obs.next({}) }),
      patch: vi.fn().mockReturnValue({ subscribe: (obs: any) => obs.next({}) }),
    };
    toastMock = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: httpMock },
        { provide: ToastService, useValue: toastMock },
        { provide: AuthService, useValue: { currentWorkspace: signal({ id: 'ws1' }).asReadonly() } },
      ],
    });

    fixture = TestBed.createComponent(ProjectMembersComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders member list', () => {
    fixture.componentInstance.members.set(mockMembers);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Alice');
    expect(el.textContent).toContain('Bob');
  });

  it('removeMember calls HTTP delete', () => {
    fixture.componentInstance.members.set(mockMembers);
    fixture.componentInstance.removeMember(mockMembers[0]);
    // remove is fire-and-forget via observable
    expect(httpMock.delete).toHaveBeenCalledWith('/api/v1/projects/p1/members/u1');
  });

  it('changes roles using userId rather than membership id', () => {
    fixture.componentInstance.changeRole(mockMembers[1], 'viewer');
    expect(httpMock.patch).toHaveBeenCalledWith(
      '/api/v1/projects/p1/members/u2',
      { role: 'viewer' },
    );
  });

  it('loads workspace contacts before adding a member', () => {
    fixture.componentInstance.openInvite();
    expect(httpMock.get).toHaveBeenCalledWith('/api/v1/workspaces/ws1/members');
  });
});
