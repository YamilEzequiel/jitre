import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AreaApiService } from './area-api.service';

describe('AreaApiService', () => {
  let api: AreaApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AreaApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(AreaApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list GETs /api/v1/workspaces/:id/areas', async () => {
    const promise = api.list('ws-1');
    const req = httpMock.expectOne('/api/v1/workspaces/ws-1/areas');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    const result = await promise;
    expect(result).toEqual([]);
  });

  it('create POSTs the dto', async () => {
    const promise = api.create('ws-1', { name: 'Tech', color: '#7c3aed' });
    const req = httpMock.expectOne('/api/v1/workspaces/ws-1/areas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Tech', color: '#7c3aed' });
    req.flush({ id: 'a1', name: 'Tech' });
    await promise;
  });

  it('update PATCHes the right url', async () => {
    const promise = api.update('ws-1', 'a1', { name: 'New' });
    const req = httpMock.expectOne('/api/v1/workspaces/ws-1/areas/a1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'New' });
    req.flush({ id: 'a1', name: 'New' });
    await promise;
  });

  it('delete DELETEs the right url', async () => {
    const promise = api.delete('ws-1', 'a1');
    const req = httpMock.expectOne('/api/v1/workspaces/ws-1/areas/a1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });
});
