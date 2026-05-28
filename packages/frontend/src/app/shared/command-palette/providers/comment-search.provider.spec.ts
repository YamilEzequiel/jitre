import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { CommentSearchProvider } from './comment-search.provider';

function flush(req: { flush: (b: unknown) => void }, hit: {
  entityId: string;
  parentType: 'task' | 'project' | null;
  parentId: string | null;
  snippet?: string;
}): void {
  req.flush({
    items: [
      {
        entityType: 'comment',
        entityId: hit.entityId,
        workspaceId: 'w1',
        rank: 0.42,
        snippet: hit.snippet ?? 'snippet',
        occurredAt: new Date().toISOString(),
        parentType: hit.parentType,
        parentId: hit.parentId,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  });
}

describe('CommentSearchProvider', () => {
  let provider: CommentSearchProvider;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      providers: [
        CommentSearchProvider,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    provider = TestBed.inject(CommentSearchProvider);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('hits /api/v1/search?type=comment', async () => {
    const promise = provider.search('blocker');
    const req = httpMock.expectOne(
      r => r.url.includes('/api/v1/search') && r.params.get('type') === 'comment',
    );
    flush(req, { entityId: 'c1', parentType: 'task', parentId: 't1', snippet: 'this is a <b>blocker</b>' });
    const results = await promise;
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('c1');
    expect(results[0].type).toBe('comment');
    expect(results[0].label).toBe('this is a blocker');
  });

  it('navigates to parent task with comment fragment', async () => {
    const router = TestBed.inject(Router);
    const promise = provider.search('x');
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/search'));
    flush(req, { entityId: 'c2', parentType: 'task', parentId: 't9', snippet: 'x' });
    const results = await promise;
    await results[0].action?.();
    expect(router.navigate).toHaveBeenCalledWith(['/tasks', 't9'], { fragment: 'comment-c2' });
  });

  it('navigates to parent project when contextType is project', async () => {
    const router = TestBed.inject(Router);
    const promise = provider.search('y');
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/search'));
    flush(req, { entityId: 'c3', parentType: 'project', parentId: 'p4', snippet: 'y' });
    const results = await promise;
    await results[0].action?.();
    expect(router.navigate).toHaveBeenCalledWith(['/projects', 'p4'], { fragment: 'comment-c3' });
  });

  it('falls back to root when parent is missing', async () => {
    const router = TestBed.inject(Router);
    const promise = provider.search('z');
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/search'));
    flush(req, { entityId: 'c4', parentType: null, parentId: null, snippet: 'z' });
    const results = await promise;
    await results[0].action?.();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
