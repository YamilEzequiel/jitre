import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { requestIdInterceptor } from './request-id.interceptor';

describe('requestIdInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([requestIdInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sets x-request-id header on each request', () => {
    http.get('/api/test').subscribe();
    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('x-request-id')).toBe(true);
    expect(req.request.headers.get('x-request-id')).toBeTruthy();
    req.flush({});
  });

  it('UUID is unique across calls', () => {
    http.get('/api/a').subscribe();
    http.get('/api/b').subscribe();
    const reqA = httpMock.expectOne('/api/a');
    const reqB = httpMock.expectOne('/api/b');
    const idA = reqA.request.headers.get('x-request-id');
    const idB = reqB.request.headers.get('x-request-id');
    expect(idA).not.toEqual(idB);
    reqA.flush({});
    reqB.flush({});
  });
});
