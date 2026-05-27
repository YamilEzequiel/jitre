import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectListComponent } from './project-list.component';
import { ProjectStore } from '../../../stores/project.store';
import { AuthService } from '../../../core/auth/auth.service';
import { ProjectApiService } from '../../../stores/project-api.service';
import { AreaStore } from '../../../stores/area.store';
import { ToastService } from '../../../core/toast/toast.service';
import { Router } from '@angular/router';
import { signal } from '@angular/core';

const mockProjects = [
  { id: '1', name: 'Alpha', key: 'ALPHA', status: 'active', workspaceId: 'ws1' },
  { id: '2', name: 'Beta', key: 'BETA', status: 'archived', workspaceId: 'ws1' },
];

describe('ProjectListComponent', () => {
  let fixture: ComponentFixture<ProjectListComponent>;
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  const projectsSignal = signal(mockProjects);

  beforeEach(() => {
    routerMock = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ProjectStore,
          useValue: {
            items: projectsSignal.asReadonly(),
            loading: signal(false).asReadonly(),
            upsert: vi.fn(),
          },
        },
        { provide: Router, useValue: routerMock },
        {
          provide: AuthService,
          useValue: {
            currentWorkspace: signal({ id: 'ws1', name: 'WS', slug: 'ws' }).asReadonly(),
          },
        },
        { provide: ProjectApiService, useValue: { create: vi.fn() } },
        {
          provide: AreaStore,
          useValue: {
            areas: signal([]).asReadonly(),
            byId: signal({} as Record<string, unknown>).asReadonly(),
            load: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(ProjectListComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders project rows from store', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Alpha');
    expect(el.textContent).toContain('Beta');
  });

  it('filters by status chip', () => {
    const comp = fixture.componentInstance;
    comp.statusFilter.set('active');
    fixture.detectChanges();
    expect(comp.filteredProjects().length).toBe(1);
    expect(comp.filteredProjects()[0].name).toBe('Alpha');
  });

  it('navigates to project detail on click', () => {
    const comp = fixture.componentInstance;
    comp.navigateToProject('1');
    expect(routerMock.navigate).toHaveBeenCalledWith(['/projects', '1']);
  });
});
