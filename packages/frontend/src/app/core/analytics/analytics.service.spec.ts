import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AnalyticsService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AnalyticsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const periodEndpoints = [
    { method: 'getVelocity', url: '/api/v1/analytics/workspace/velocity' },
    { method: 'getThroughput', url: '/api/v1/analytics/workspace/throughput' },
    { method: 'getAiUsage', url: '/api/v1/analytics/workspace/ai-usage' },
  ] as const;

  for (const { method, url } of periodEndpoints) {
    it(`${method} calls GET ${url} with date range params`, async () => {
      const promise = (service[method] as (from: string, to: string) => Promise<unknown>)(
        '2024-01-01T00:00:00.000Z',
        '2024-01-31T23:59:59.999Z',
      );
      const req = httpMock.expectOne(r => r.url === url);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('from')).toBe('2024-01-01T00:00:00.000Z');
      expect(req.request.params.get('period')).toBe('day');
      req.flush([]);
      await promise;
    });
  }

  it('getWorkload calls workspace workload with groupBy', async () => {
    const promise = service.getWorkload('assignee');
    const req = httpMock.expectOne('/api/v1/analytics/workspace/workload?groupBy=assignee');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('lastNDays returns UTC ISO strings with correct range', () => {
    const { from, to } = service.lastNDays(7);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
