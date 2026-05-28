import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { TaskSearchProvider } from './task-search.provider';

function flushHit(req: { flush: (body: unknown) => void }, hit: Partial<{ entityId: string; snippet: string }>): void {
  req.flush({
    items: [
      {
        entityType: 'task',
        entityId: hit.entityId,
        workspaceId: 'w1',
        rank: 0.42,
        snippet: hit.snippet ?? 'snippet',
        occurredAt: new Date().toISOString(),
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  });
}

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
    flushHit(req, { entityId: 't1', snippet: 'Fix the <b>bug</b>' });
    const results = await promise;
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('t1');
    expect(results[0].label).toBe('Fix the bug');
    expect(results[0].description).toBe('Fix the <b>bug</b>');
  });

  it('maps results to CommandResult with navigation action', async () => {
    const router = TestBed.inject(Router);
    const promise = provider.search('test');
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/search'));
    flushHit(req, { entityId: 't2', snippet: 'Test <b>task</b>' });
    const results = await promise;
    expect(results[0].type).toBe('task');
    expect(typeof results[0].action).toBe('function');
    await results[0].action?.();
    expect(router.navigate).toHaveBeenCalledWith(['/tasks', 't2']);
  });

  it('returns empty array when backend returns empty items', async () => {
    const promise = provider.search('zzz');
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/search'));
    req.flush({ items: [], total: 0, page: 1, pageSize: 20 });
    const results = await promise;
    expect(results).toEqual([]);
  });
});
