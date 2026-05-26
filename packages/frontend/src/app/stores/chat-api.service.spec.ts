import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ChatApiService } from './chat-api.service';

describe('ChatApiService', () => {
  let api: ChatApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChatApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ChatApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('listChannels GETs /api/v1/chat/channels', async () => {
    const promise = api.listChannels();
    const req = httpMock.expectOne('/api/v1/chat/channels');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('createChannel POSTs to /api/v1/chat/channels with body', async () => {
    const promise = api.createChannel({ name: 'a', type: 'public' });
    const req = httpMock.expectOne('/api/v1/chat/channels');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'a', type: 'public' });
    req.flush({ id: 'x' });
    await promise;
  });

  it('openOrCreateDM POSTs to /api/v1/chat/dm', async () => {
    const promise = api.openOrCreateDM('u9');
    const req = httpMock.expectOne('/api/v1/chat/dm');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ otherUserId: 'u9' });
    req.flush({ id: 'dm-x' });
    await promise;
  });

  it('getProjectChannel GETs the linked project chat', async () => {
    const promise = api.getProjectChannel('p1');
    const req = httpMock.expectOne('/api/v1/chat/projects/p1/channel');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'chat-p1' });
    await promise;
  });

  it('listWorkspaceContacts GETs safe DM candidates', async () => {
    const promise = api.listWorkspaceContacts('ws1');
    const req = httpMock.expectOne('/api/v1/workspaces/ws1/members');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('listMessages forwards before/limit as query params', async () => {
    const promise = api.listMessages('c1', { before: 'mid', limit: 25 });
    const req = httpMock.expectOne(r => r.url === '/api/v1/chat/channels/c1/messages');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('before')).toBe('mid');
    expect(req.request.params.get('limit')).toBe('25');
    req.flush({ data: [], hasMore: false, nextCursor: null });
    await promise;
  });

  it('markAsRead posts the last messageId', async () => {
    const promise = api.markAsRead('c1', 'm-last');
    const req = httpMock.expectOne('/api/v1/chat/channels/c1/read');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ messageId: 'm-last' });
    req.flush(null);
    await promise;
  });

  it('search includes q query param', async () => {
    const promise = api.search('hello');
    const req = httpMock.expectOne(r => r.url === '/api/v1/chat/search');
    expect(req.request.params.get('q')).toBe('hello');
    req.flush([]);
    await promise;
  });
});
