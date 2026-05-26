import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { AuthUser, AuthWorkspace } from './auth.types';

const mockUser: AuthUser = { id: 'u1', email: 'test@x.com', displayName: 'Test', role: 'member' };
const mockWorkspace: AuthWorkspace = { id: 'ws1', name: 'WS', slug: 'ws', role: 'member' };

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    document.cookie = 'csrf_token=; max-age=0; path=/';
    localStorage.removeItem('jitre:dev-mock');
    httpMock.verify();
  });

  it('login happy path — sets user, workspace, token signals', async () => {
    const promise = service.login({ email: 'test@x.com', password: 'pass' });
    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({ accessToken: 'tok', user: mockUser, workspace: mockWorkspace });
    await promise;
    expect(service.currentUser()).toEqual(mockUser);
    expect(service.currentWorkspace()).toEqual(mockWorkspace);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('login bad credentials — rejects and leaves signals null', async () => {
    const promise = service.login({ email: 'test@x.com', password: 'wrong' });
    const req = httpMock.expectOne('/api/v1/auth/login');
    req.flush({ title: 'Unauthorized', status: 401 }, { status: 401, statusText: 'Unauthorized' });
    await expect(promise).rejects.toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('refresh single-flight — concurrent calls share one HTTP request', async () => {
    // seed a token so refresh is allowed
    const loginPromise = service.login({ email: 'x@x.com', password: 'p' });
    const loginReq = httpMock.expectOne('/api/v1/auth/login');
    loginReq.flush({ accessToken: 'tok', user: mockUser, workspace: mockWorkspace });
    await loginPromise;

    // fire two concurrent refresh calls
    const r1 = service.refresh();
    const r2 = service.refresh();
    // only ONE http request should have been made
    const reqs = httpMock.match('/api/v1/auth/refresh');
    expect(reqs.length).toBe(1);
    reqs[0].flush({ accessToken: 'newtok' });
    await Promise.all([r1, r2]);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('logout — clears user, workspace, token signals', async () => {
    const loginPromise = service.login({ email: 'x@x.com', password: 'p' });
    const loginReq = httpMock.expectOne('/api/v1/auth/login');
    loginReq.flush({ accessToken: 'tok', user: mockUser, workspace: mockWorkspace });
    await loginPromise;
    expect(service.isAuthenticated()).toBe(true);

    service.logout();
    // logout may optionally call backend; flush if there is a request
    const logoutReqs = httpMock.match('/api/v1/auth/logout');
    logoutReqs.forEach(r => r.flush({}));

    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.currentWorkspace()).toBeNull();
  });

  it('hydrate — on cold boot, calls refresh and populates state on success', async () => {
    document.cookie = 'csrf_token=test-token; path=/';
    const p = service.hydrate();
    const req = httpMock.expectOne('/api/v1/auth/refresh');
    req.flush({ accessToken: 'hydratedTok', user: mockUser, workspace: mockWorkspace });
    await p;
    // hydrate alone doesn't set user — needs a /me call or the refresh response includes user
    // for this test we only assert the promise resolves without throwing
    expect(service.currentUser()).toEqual(mockUser);
  });
});
