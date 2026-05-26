import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ProjectSearchProvider } from './project-search.provider';

describe('ProjectSearchProvider', () => {
  let provider: ProjectSearchProvider;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectSearchProvider, provideHttpClient(), provideHttpClientTesting()],
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
    req.flush([{ id: 'p1', name: 'My Project' }]);
    const results = await promise;
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('project');
  });

  it('maps results to CommandResult with navigate action', async () => {
    const promise = provider.search('test');
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/search'));
    req.flush([{ id: 'p2', name: 'Test Project' }]);
    const results = await promise;
    expect(typeof results[0].action).toBe('function');
  });
});
