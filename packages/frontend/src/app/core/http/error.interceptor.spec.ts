import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from './error.interceptor';
import { ToastService } from '../toast/toast.service';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let toastService: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toastService = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toastService },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('RFC 7807 error body triggers toast.error with the title', () => {
    let caught = false;
    http.get('/api/v1/tasks').subscribe({ error: () => { caught = true; } });
    const req = httpMock.expectOne('/api/v1/tasks');
    req.flush({ title: 'Not Found', status: 404, detail: 'Task missing' }, { status: 404, statusText: 'Not Found' });
    expect(toastService.error).toHaveBeenCalledWith('Not Found');
    expect(caught).toBe(true);
  });

  it('skips 401 errors (handled by jwtInterceptor)', () => {
    http.get('/api/v1/tasks').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/tasks');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(toastService.error).not.toHaveBeenCalled();
  });

  it('re-throws the error so callers can handle it', () => {
    let caught = false;
    http.get('/api/v1/tasks').subscribe({ error: () => { caught = true; } });
    const req = httpMock.expectOne('/api/v1/tasks');
    req.flush({ title: 'Server Error' }, { status: 500, statusText: 'Internal Server Error' });
    expect(caught).toBe(true);
  });
});
