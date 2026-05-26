import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { jwtInterceptor } from './jwt.interceptor';
import { AuthService } from '../auth/auth.service';

describe('jwtInterceptor — with valid token', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getAccessToken: vi.fn(() => 'test-token'),
            logout: vi.fn(),
            refresh: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('adds Authorization Bearer header when token is present', () => {
    http.get('/api/v1/tasks').subscribe();
    const req = httpMock.expectOne('/api/v1/tasks');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush({});
  });

  it('401 response triggers refresh-then-retry', async () => {
    http.get('/api/v1/tasks').subscribe({ error: () => {} });

    const req1 = httpMock.expectOne('/api/v1/tasks');
    req1.flush({}, { status: 401, statusText: 'Unauthorized' });

    await new Promise(resolve => setTimeout(resolve, 0));

    const auth = TestBed.inject(AuthService);
    const req2 = httpMock.expectOne('/api/v1/tasks');
    req2.flush({ items: [] });

    expect(auth.refresh).toHaveBeenCalled();
  });
});

describe('jwtInterceptor — refresh failure logs out', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let logoutFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logoutFn = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getAccessToken: vi.fn(() => 'test-token'),
            logout: logoutFn,
            refresh: vi.fn().mockRejectedValue(new Error('refresh failed')),
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('refresh failure calls logout and propagates error', async () => {
    let errorCaught = false;
    http.get('/api/v1/tasks').subscribe({ error: () => { errorCaught = true; } });

    const req1 = httpMock.expectOne('/api/v1/tasks');
    req1.flush({}, { status: 401, statusText: 'Unauthorized' });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(logoutFn).toHaveBeenCalled();
    expect(errorCaught).toBe(true);
  });
});

describe('jwtInterceptor — skips refresh URL', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let refreshFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refreshFn = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getAccessToken: vi.fn(() => 'test-token'),
            logout: vi.fn(),
            refresh: refreshFn,
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('skips refresh URL to avoid infinite loop', async () => {
    http.post('/api/v1/auth/refresh', {}).subscribe({ error: () => {} });
    const req1 = httpMock.expectOne('/api/v1/auth/refresh');
    req1.flush({}, { status: 401, statusText: 'Unauthorized' });

    await new Promise(resolve => setTimeout(resolve, 0));
    httpMock.expectNone('/api/v1/auth/refresh');
    expect(refreshFn).not.toHaveBeenCalled();
  });
});
