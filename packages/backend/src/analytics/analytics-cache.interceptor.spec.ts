import { AnalyticsCacheInterceptor } from './analytics-cache.interceptor';
import { of, throwError } from 'rxjs';

const makeContext = () => {
  const res = { setHeader: jest.fn() };
  return {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: jest.fn().mockReturnValue(res),
    }),
    _res: res,
  };
};

const makeCallHandler = (value: unknown, shouldThrow = false) => ({
  handle: jest
    .fn()
    .mockReturnValue(
      shouldThrow ? throwError(() => new Error('oops')) : of(value),
    ),
});

describe('AnalyticsCacheInterceptor', () => {
  let interceptor: AnalyticsCacheInterceptor;

  beforeEach(() => {
    interceptor = new AnalyticsCacheInterceptor();
  });

  it('sets Cache-Control header on successful response', (done) => {
    const ctx = makeContext();
    const next = makeCallHandler([{ period: '2026-W19', value: 3 }]);

    interceptor.intercept(ctx as never, next as never).subscribe({
      next: () => {
        expect(ctx._res.setHeader).toHaveBeenCalledWith(
          'Cache-Control',
          'public, max-age=300, stale-while-revalidate=60',
        );
        done();
      },
      error: done,
    });
  });

  it('does NOT set Cache-Control on error', (done) => {
    const ctx = makeContext();
    const next = makeCallHandler(null, true);

    interceptor.intercept(ctx as never, next as never).subscribe({
      next: () => done(new Error('should not emit')),
      error: () => {
        expect(ctx._res.setHeader).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('passes the response value through unchanged', (done) => {
    const ctx = makeContext();
    const expected = [{ period: '2026-W19', value: 5 }];
    const next = makeCallHandler(expected);

    interceptor.intercept(ctx as never, next as never).subscribe({
      next: (value) => {
        expect(value).toEqual(expected);
        done();
      },
      error: done,
    });
  });
});
