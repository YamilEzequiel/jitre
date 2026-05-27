import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { AiCreateDialogComponent } from './ai-create-dialog.component';
import { AiCreateService } from './ai-create.service';
import { AiGeneratorApiService } from '../../core/ai/ai-generator.service';
import { ProjectStore } from '../../stores/project.store';
import { ToastService } from '../../core/toast/toast.service';
import type { Project } from '../../stores/project-api.service';

describe('AiCreateDialogComponent', () => {
  let fixture: ComponentFixture<AiCreateDialogComponent>;

  const project: Project = {
    id: 'p1',
    name: 'Atlas',
    key: 'ATL',
    status: 'active',
    workspaceId: 'ws1',
  };

  const isOpen = signal(false);
  const projectsSig = signal<Project[]>([project]);
  const apiMock = {
    draft: vi.fn(),
    commit: vi.fn(),
  };
  const stateMock = {
    isOpen: isOpen.asReadonly(),
    open: vi.fn(() => isOpen.set(true)),
    close: vi.fn(() => isOpen.set(false)),
    toggle: vi.fn(),
  };
  const projectStoreMock = {
    items: projectsSig.asReadonly(),
    byId: signal<Record<string, Project>>({ p1: project }).asReadonly(),
  };
  const toastMock = { success: vi.fn(), error: vi.fn() };
  const routerMock = { navigate: vi.fn().mockResolvedValue(true) };

  beforeEach(() => {
    vi.clearAllMocks();
    isOpen.set(false);

    TestBed.configureTestingModule({
      providers: [
        { provide: AiCreateService, useValue: stateMock },
        { provide: AiGeneratorApiService, useValue: apiMock },
        { provide: ProjectStore, useValue: projectStoreMock },
        { provide: ToastService, useValue: toastMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    fixture = TestBed.createComponent(AiCreateDialogComponent);
    fixture.detectChanges();
  });

  function getText(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('renders nothing while closed', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the prompt input when opened', () => {
    isOpen.set(true);
    fixture.detectChanges();
    expect(getText()).toContain('Create from a prompt');
    expect((fixture.nativeElement as HTMLElement).querySelector('textarea')).toBeTruthy();
  });

  it('calls the draft endpoint with the typed prompt and shows the preview', async () => {
    apiMock.draft.mockResolvedValueOnce({
      drafts: [{ kind: 'task', title: 'Ship the docs' }],
      model: 'gemini',
      costUsd: '0',
    });

    isOpen.set(true);
    fixture.detectChanges();

    const instance = fixture.componentInstance as unknown as {
      prompt: { set: (v: string) => void };
      generate: () => Promise<void>;
      draftKind: () => string | null;
      taskTitle: () => string;
    };
    instance.prompt.set('we need docs shipped');
    await instance.generate();
    fixture.detectChanges();

    expect(apiMock.draft).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'we need docs shipped' }),
    );
    expect(instance.draftKind()).toBe('task');
    expect(instance.taskTitle()).toBe('Ship the docs');
    expect(getText()).toContain('Task draft');
  });

  it('commits the edited draft, toasts, navigates and closes', async () => {
    apiMock.draft.mockResolvedValueOnce({
      drafts: [{ kind: 'task', title: 'Stub', projectId: 'p1' }],
      model: 'gemini',
      costUsd: '0',
    });
    apiMock.commit.mockResolvedValueOnce({ kind: 'task', id: 'T-new' });

    isOpen.set(true);
    fixture.detectChanges();

    const instance = fixture.componentInstance as unknown as {
      prompt: { set: (v: string) => void };
      generate: () => Promise<void>;
      taskTitle: { set: (v: string) => void };
      commit: () => Promise<void>;
    };
    instance.prompt.set('plan a launch');
    await instance.generate();
    fixture.detectChanges();

    // user tweaks the title before committing
    instance.taskTitle.set('Launch v2');
    await instance.commit();

    expect(apiMock.commit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'task', title: 'Launch v2', projectId: 'p1' }),
    );
    expect(toastMock.success).toHaveBeenCalled();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/tasks', 'T-new']);
    expect(stateMock.close).toHaveBeenCalled();
  });

  it('surfaces a parse error from the backend as an in-dialog message', async () => {
    apiMock.draft.mockRejectedValueOnce({
      error: { message: 'AI response could not be parsed: bad json' },
    });

    isOpen.set(true);
    fixture.detectChanges();

    const instance = fixture.componentInstance as unknown as {
      prompt: { set: (v: string) => void };
      generate: () => Promise<void>;
      errorMessage: () => string | null;
      mode: () => string;
    };
    instance.prompt.set('noise');
    await instance.generate();

    expect(instance.errorMessage()).toContain('bad json');
    expect(instance.mode()).toBe('idle');
  });

  it('navigates to /docs when committing a doc draft', async () => {
    apiMock.draft.mockResolvedValueOnce({
      drafts: [{ kind: 'doc', title: 'Onboarding', body: 'hi' }],
      model: 'gemini',
      costUsd: '0',
    });
    apiMock.commit.mockResolvedValueOnce({ kind: 'doc', id: 'D-new' });
    isOpen.set(true);
    fixture.detectChanges();

    const instance = fixture.componentInstance as unknown as {
      prompt: { set: (v: string) => void };
      generate: () => Promise<void>;
      commit: () => Promise<void>;
    };
    instance.prompt.set('wiki please');
    await instance.generate();
    await instance.commit();

    expect(routerMock.navigate).toHaveBeenCalledWith(['/docs', 'D-new']);
  });

  it('navigates to /projects when committing a project draft', async () => {
    apiMock.draft.mockResolvedValueOnce({
      drafts: [{ kind: 'project', name: 'Atlas', key: 'ATL' }],
      model: 'gemini',
      costUsd: '0',
    });
    apiMock.commit.mockResolvedValueOnce({ kind: 'project', id: 'P-new' });
    isOpen.set(true);
    fixture.detectChanges();

    const instance = fixture.componentInstance as unknown as {
      prompt: { set: (v: string) => void };
      generate: () => Promise<void>;
      commit: () => Promise<void>;
    };
    instance.prompt.set('new project');
    await instance.generate();
    await instance.commit();

    expect(routerMock.navigate).toHaveBeenCalledWith(['/projects', 'P-new']);
  });

  it('restart() returns to the idle prompt screen', async () => {
    apiMock.draft.mockResolvedValueOnce({
      drafts: [{ kind: 'task', title: 'X' }],
      model: 'gemini',
      costUsd: '0',
    });
    isOpen.set(true);
    fixture.detectChanges();

    const instance = fixture.componentInstance as unknown as {
      prompt: { set: (v: string) => void };
      generate: () => Promise<void>;
      restart: () => void;
      mode: () => string;
    };
    instance.prompt.set('do thing');
    await instance.generate();
    expect(instance.mode()).toBe('preview');
    instance.restart();
    expect(instance.mode()).toBe('idle');
  });
});
