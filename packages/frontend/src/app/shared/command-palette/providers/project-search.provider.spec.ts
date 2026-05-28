import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { ProjectSearchProvider } from './project-search.provider';

function flushHit(req: { flush: (body: unknown) => void }, hit: Partial<{ entityId: string; snippet: string }>): void {
  req.flush({
    items: [
      {
        entityType: 'project',
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

describe('ProjectSearchProvider', () => {
  let provider: ProjectSearchProvider;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      providers: [
        ProjectSearchProvider,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    provider = TestBed.inject(ProjectSearchProvider);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('calls /api/v1/search?type=project', async () => {
    const promise = provider.search('my project');
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/search') && r.params.get('type') === 'project');
    flushHit(req, { entityId: 'p1', snippet: 'My <b>project</b>' });
    const results = await promise;
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('project');
    expect(results[0].label).toBe('My project');
  });

  it('navigates to /projects/:id on action', async () => {
    const router = TestBed.inject(Router);
    const promise = provider.search('test');
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/search'));
    flushHit(req, { entityId: 'p2', snippet: 'Test' });
    const results = await promise;
    await results[0].action?.();
    expect(router.navigate).toHaveBeenCalledWith(['/projects', 'p2']);
  });
});
