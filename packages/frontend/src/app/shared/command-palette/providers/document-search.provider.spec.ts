import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { DocumentSearchProvider } from './document-search.provider';

describe('DocumentSearchProvider', () => {
  let provider: DocumentSearchProvider;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      providers: [
        DocumentSearchProvider,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    provider = TestBed.inject(DocumentSearchProvider);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('calls /api/v1/search?type=document', async () => {
    const promise = provider.search('runbook');
    const req = httpMock.expectOne(
      r => r.url.includes('/api/v1/search') && r.params.get('type') === 'document',
    );
    req.flush({
      items: [
        {
          entityType: 'document',
          entityId: 'd1',
          workspaceId: 'w1',
          rank: 0.5,
          snippet: 'Deploy <b>runbook</b>',
          occurredAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const results = await promise;
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('d1');
    expect(results[0].type).toBe('document');
    expect(results[0].label).toBe('Deploy runbook');
  });

  it('navigates to /docs/:id on action', async () => {
    const router = TestBed.inject(Router);
    const promise = provider.search('x');
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/search'));
    req.flush({
      items: [
        {
          entityType: 'document',
          entityId: 'd2',
          workspaceId: 'w1',
          rank: 0.1,
          snippet: 'x',
          occurredAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const results = await promise;
    await results[0].action?.();
    expect(router.navigate).toHaveBeenCalledWith(['/docs', 'd2']);
  });
});
