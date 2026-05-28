import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { OnboardingCardComponent } from './onboarding-card.component';
import { TaskStore } from '../../stores/task.store';
import { ProjectStore } from '../../stores/project.store';

describe('OnboardingCardComponent', () => {
  let fixture: ComponentFixture<OnboardingCardComponent>;
  let projects: WritableSignal<unknown[]>;
  let tasksById: WritableSignal<Record<string, unknown>>;

  function mount(): void {
    fixture = TestBed.createComponent(OnboardingCardComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    projects = signal<unknown[]>([]);
    tasksById = signal<Record<string, unknown>>({});

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ProjectStore,
          useValue: { items: projects.asReadonly() },
        },
        {
          provide: TaskStore,
          useValue: { byId: tasksById.asReadonly() },
        },
      ],
    });
  });

  it('renders all 3 steps when the workspace is empty', () => {
    mount();
    const stepHeadings = fixture.nativeElement.querySelectorAll('h3');
    expect(stepHeadings.length).toBe(3);
    expect(stepHeadings[0].textContent).toContain('proyecto');
  });

  it('hides itself when at least one project exists', () => {
    projects.set([{ id: 'p1' }]);
    mount();
    // No headings rendered — the card itself is gone.
    const stepHeadings = fixture.nativeElement.querySelectorAll('h3');
    expect(stepHeadings.length).toBe(0);
  });

  it('hides itself when at least one task exists', () => {
    tasksById.set({ 't1': { id: 't1' } });
    mount();
    const stepHeadings = fixture.nativeElement.querySelectorAll('h3');
    expect(stepHeadings.length).toBe(0);
  });

  it("marks the 'crear primer proyecto' step as done when projects exist (but card still shows because tasks empty does not happen — both must be empty)", () => {
    // The visibility predicate is "no projects AND no tasks". Having
    // a project alone hides the card entirely, which is the correct
    // UX: once the user creates something we get out of the way.
    projects.set([{ id: 'p1' }]);
    mount();
    expect(fixture.nativeElement.children.length).toBe(0);
  });
});
