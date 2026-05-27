import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OrgGraphApiService } from './org-graph-api.service';

describe('OrgGraphApiService', () => {
  let api: OrgGraphApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OrgGraphApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(OrgGraphApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getOrgGraph GETs /api/v1/workspaces/:id/org-graph', async () => {
    const promise = api.getOrgGraph('ws-1');
    const req = httpMock.expectOne('/api/v1/workspaces/ws-1/org-graph');
    expect(req.request.method).toBe('GET');
    req.flush({ nodes: [], edges: [] });
    const result = await promise;
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('addReport POSTs to /reports with userId + supervisorId', async () => {
    const promise = api.addReport('ws-1', 'u-1', 'u-2');
    const req = httpMock.expectOne('/api/v1/workspaces/ws-1/reports');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'u-1', supervisorId: 'u-2' });
    req.flush({});
    await promise;
  });

  it('removeReport DELETEs the nested route', async () => {
    const promise = api.removeReport('ws-1', 'u-1', 'u-2');
    const req = httpMock.expectOne(
      '/api/v1/workspaces/ws-1/reports/u-1/supervisor/u-2',
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });
});
