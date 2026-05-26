import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardComponent } from './dashboard.component';
import { TaskStore } from '../../stores/task.store';
import { ProjectStore } from '../../stores/project.store';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let analyticsMock: { getWorkspaceStats: ReturnType<typeof vi.fn> };
  const tasksSignal = signal<unknown[]>([]);
  const projectsSignal = signal<unknown[]>([]);

  beforeEach(() => {
    analyticsMock = {
      getWorkspaceStats: vi.fn().mockResolvedValue({
        totalTasks: 42,
        completedTasks: 18,
        openProjects: 5,
        teamMembers: 3,
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TaskStore, useValue: { items: tasksSignal.asReadonly(), loading: signal(false).asReadonly() } },
        { provide: ProjectStore, useValue: { items: projectsSignal.asReadonly(), loading: signal(false).asReadonly() } },
        { provide: AnalyticsService, useValue: analyticsMock },
      ],
    });

    fixture = TestBed.createComponent(DashboardComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows skeleton loaders during loading', () => {
    const comp = fixture.componentInstance;
    // loading is true before stats resolve
    expect(comp.statsLoading()).toBe(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('jt-skeleton')).toBeTruthy();
  });

  it('fetches analytics stats on init', async () => {
    fixture.detectChanges();
    await Promise.resolve();
    expect(analyticsMock.getWorkspaceStats).toHaveBeenCalled();
  });

  it('renders readable dashboard shortcut copy without broken characters', () => {
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Tasks, projects and analytics — at a glance.');
    expect(text).toContain('⌘K');
    expect(text).not.toContain('â');
  });

  it('shows stats after loading resolves', async () => {
    fixture.detectChanges();
    await fixture.componentInstance.statsPromise;
    fixture.detectChanges();
    expect(fixture.componentInstance.statsLoading()).toBe(false);
  });
});
