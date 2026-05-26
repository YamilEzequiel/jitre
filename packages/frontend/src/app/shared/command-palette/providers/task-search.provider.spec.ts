import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { TaskSearchProvider } from './task-search.provider';

describe('TaskSearchProvider', () => {
  let provider: TaskSearchProvider;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      providers: [
        TaskSearchProvider,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    provider = TestBed.inject(TaskSearchProvider);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('calls /api/v1/search?type=task&q=...', async () => {
    const promise = provider.search('fix bug');
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/search') && r.params.get('type') === 'task');
    req.flush([{ id: 't1', title: 'Fix the bug', projectId: 'p1' }]);
    const results = await promise;
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('t1');
  });

  it('maps results to CommandResult with navigation action', async () => {
    const router = TestBed.inject(Router);
    const promise = provider.search('test');
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/search'));
    req.flush([{ id: 't2', title: 'Test task', projectId: 'p1' }]);
    const results = await promise;
    expect(results[0].type).toBe('task');
    expect(typeof results[0].action).toBe('function');
    await results[0].action?.();
    expect(router.navigate).toHaveBeenCalledWith(['/tasks', 't2'], {
      queryParams: { projectId: 'p1' },
    });
  });
});
