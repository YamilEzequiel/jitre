import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TaskChecklistApiService } from './task-checklist-api.service';

describe('TaskChecklistApiService', () => {
  let api: TaskChecklistApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TaskChecklistApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(TaskChecklistApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list GETs /api/v1/tasks/:id/checklist', async () => {
    const p = api.list('task-1');
    const req = httpMock.expectOne('/api/v1/tasks/task-1/checklist');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await p;
  });

  it('create POSTs body', async () => {
    const p = api.create('task-1', { content: 'crit' });
    const req = httpMock.expectOne('/api/v1/tasks/task-1/checklist');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ content: 'crit' });
    req.flush({ id: 'i1' });
    await p;
  });

  it('update PATCHes the item', async () => {
    const p = api.update('task-1', 'i1', { content: 'new' });
    const req = httpMock.expectOne('/api/v1/tasks/task-1/checklist/i1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ content: 'new' });
    req.flush({ id: 'i1', content: 'new' });
    await p;
  });

  it('setStatus PATCHes the status endpoint', async () => {
    const p = api.setStatus('task-1', 'i1', 'passed');
    const req = httpMock.expectOne(
      '/api/v1/tasks/task-1/checklist/i1/status',
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'passed' });
    req.flush({ id: 'i1' });
    await p;
  });

  it('reorder POSTs orderedIds', async () => {
    const p = api.reorder('task-1', ['a', 'b']);
    const req = httpMock.expectOne(
      '/api/v1/tasks/task-1/checklist/reorder',
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ orderedIds: ['a', 'b'] });
    req.flush(null);
    await p;
  });

  it('remove DELETEs the item', async () => {
    const p = api.remove('task-1', 'i1');
    const req = httpMock.expectOne('/api/v1/tasks/task-1/checklist/i1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await p;
  });
});
