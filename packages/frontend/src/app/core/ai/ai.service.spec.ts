import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      httpMock.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('describeTask posts to the task describe endpoint', async () => {
    const promise = service.describeTask('task-123');
    const req = httpMock.expectOne('/api/v1/ai/tasks/task-123/describe');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ description: 'A task' });
    const result = await promise;
    expect(result).toEqual({ description: 'A task' });
  });

  it('suggestSubtasks posts to the task suggestions endpoint', async () => {
    const promise = service.suggestSubtasks('task-456');
    const req = httpMock.expectOne('/api/v1/ai/tasks/task-456/suggest-subtasks');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ suggestions: ['sub1', 'sub2'] });
    const result = await promise;
    expect((result as { suggestions: string[] }).suggestions).toHaveLength(2);
  });

  it('loading signal toggles true during call and false after', async () => {
    expect(service.loading.describe()).toBe(false);
    const promise = service.describeTask('t1');
    expect(service.loading.describe()).toBe(true);
    const req = httpMock.expectOne('/api/v1/ai/tasks/t1/describe');
    req.flush({ description: 'done' });
    await promise;
    expect(service.loading.describe()).toBe(false);
  });

  it('rethrows errors from API calls', async () => {
    const promise = service.describeTask('t-err');
    const req = httpMock.expectOne('/api/v1/ai/tasks/t-err/describe');
    req.flush({ title: 'Error' }, { status: 500, statusText: 'Internal Server Error' });
    await expect(promise).rejects.toBeTruthy();
    expect(service.loading.describe()).toBe(false);
  });
});
