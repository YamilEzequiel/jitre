import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiSubtaskSuggestComponent } from './ai-subtask-suggest.component';
import { AiService } from '../../../core/ai/ai.service';
import { TaskApiService } from '../../../stores/task-api.service';
import { TaskStore } from '../../../stores/task.store';
import { WorkflowStatusStore } from '../../../stores/workflow-status.store';
import { ToastService } from '../../../core/toast/toast.service';
import { signal, computed } from '@angular/core';

const mockSuggestions = ['Write tests', 'Fix the null check', 'Update docs'];

describe('AiSubtaskSuggestComponent', () => {
  let fixture: ComponentFixture<AiSubtaskSuggestComponent>;
  let aiMock: { suggestSubtasks: ReturnType<typeof vi.fn>; loading: { suggestSubtasks: ReturnType<typeof signal> } };
  let apiMock: { create: ReturnType<typeof vi.fn> };
  let storeMock: { upsert: ReturnType<typeof vi.fn>; byId: ReturnType<typeof computed> };
  let statusStoreMock: { byProject: ReturnType<typeof vi.fn> };
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    aiMock = {
      suggestSubtasks: vi.fn().mockResolvedValue({ subtasks: mockSuggestions }),
      loading: { suggestSubtasks: signal(false) },
    };
    apiMock = {
      create: vi.fn().mockResolvedValue({
        id: 'sub1', title: 'Write tests', statusId: 'status-1',
        projectId: 'p1', workspaceId: 'ws1', priority: 'none', type: 'task', rank: 'n',
      }),
    };
    const parentTask = {
      id: 't1', title: 'Parent', statusId: 'parent-status',
      projectId: 'p1', workspaceId: 'ws1', priority: 'none', type: 'task', rank: 'n',
    };
    storeMock = {
      upsert: vi.fn(),
      byId: computed(() => ({ t1: parentTask }) as Record<string, typeof parentTask>),
    };
    statusStoreMock = {
      byProject: vi.fn(() => signal([
        { id: 'status-1', projectId: 'p1', workspaceId: 'ws1', name: 'Todo', category: 'todo', order: 0, isDefault: true },
      ])),
    };
    toastMock = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: AiService, useValue: aiMock },
        { provide: TaskApiService, useValue: apiMock },
        { provide: TaskStore, useValue: storeMock },
        { provide: WorkflowStatusStore, useValue: statusStoreMock },
        { provide: ToastService, useValue: toastMock },
      ],
    });

    fixture = TestBed.createComponent(AiSubtaskSuggestComponent);
    fixture.componentRef.setInput('taskId', 't1');
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('fetchSuggestions populates suggestions signal', async () => {
    await fixture.componentInstance.fetchSuggestions();
    expect(fixture.componentInstance.suggestions()).toEqual(mockSuggestions);
  });

  it('confirm creates checked subtasks with parent statusId + parentTaskId', async () => {
    await fixture.componentInstance.fetchSuggestions();
    fixture.componentInstance.checked.set(new Set(['Write tests']));
    await fixture.componentInstance.confirm();
    expect(apiMock.create).toHaveBeenCalledTimes(1);
    expect(apiMock.create).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ title: 'Write tests', statusId: 'parent-status', parentTaskId: 't1' }),
    );
    expect(storeMock.upsert).toHaveBeenCalledTimes(1);
  });
});
