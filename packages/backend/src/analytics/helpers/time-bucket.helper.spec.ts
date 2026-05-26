import { TimeBucketHelper } from './time-bucket.helper';

describe('TimeBucketHelper', () => {
  describe('formatForPeriod()', () => {
    it('returns YYYY-MM-DD for day', () => {
      expect(TimeBucketHelper.formatForPeriod('day')).toBe('YYYY-MM-DD');
    });

    it('returns IYYY-"W"IW for week (ISO 8601)', () => {
      expect(TimeBucketHelper.formatForPeriod('week')).toBe('IYYY-"W"IW');
    });

    it('returns YYYY-MM for month', () => {
      expect(TimeBucketHelper.formatForPeriod('month')).toBe('YYYY-MM');
    });
  });

  describe('dateTruncExpr()', () => {
    it('builds date_trunc SQL expression for day', () => {
      const expr = TimeBucketHelper.dateTruncExpr('day', 'occurred_at');
      expect(expr).toContain("date_trunc('day'");
      expect(expr).toContain('occurred_at');
    });

    it('builds date_trunc SQL expression for week', () => {
      const expr = TimeBucketHelper.dateTruncExpr('week', 'created_at');
      expect(expr).toContain("date_trunc('week'");
    });

    it('anchors to UTC timezone', () => {
      const expr = TimeBucketHelper.dateTruncExpr('month', 'occurred_at');
      expect(expr).toContain('UTC');
    });
  });

  describe('bucketStart()', () => {
    it('returns Monday 00:00:00 UTC for any date in that ISO week', () => {
      // 2026-05-21 is a Thursday; ISO week Monday = 2026-05-18
      const result = TimeBucketHelper.bucketStart(
        'week',
        new Date('2026-05-21T12:00:00Z'),
      );
      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
    });

    it('Monday input returns same date as bucket start', () => {
      const monday = new Date('2026-05-18T00:00:00Z');
      const result = TimeBucketHelper.bucketStart('week', monday);
      expect(result.toISOString().slice(0, 10)).toBe('2026-05-18');
    });

    it('returns first day of month for month period', () => {
      const result = TimeBucketHelper.bucketStart(
        'month',
        new Date('2026-05-15T12:00:00Z'),
      );
      expect(result.getUTCDate()).toBe(1);
      expect(result.getUTCMonth()).toBe(4); // May = 4 (0-indexed)
    });

    it('returns same day at midnight UTC for day period', () => {
      const result = TimeBucketHelper.bucketStart(
        'day',
        new Date('2026-05-15T18:30:00Z'),
      );
      expect(result.toISOString().slice(0, 10)).toBe('2026-05-15');
      expect(result.getUTCHours()).toBe(0);
    });

    it('handles ISO week 53 (2026-W53 does not exist; 2020-W53 does)', () => {
      // 2020-12-31 is in ISO week 53 of 2020
      const result = TimeBucketHelper.bucketStart(
        'week',
        new Date('2020-12-31T00:00:00Z'),
      );
      expect(result.getUTCDay()).toBe(1); // Monday
    });

    it('2026-W01 Monday = 2025-12-29 (ISO 8601)', () => {
      // 2026-01-01 is a Thursday, belongs to 2026-W01, which starts 2025-12-29
      const result = TimeBucketHelper.bucketStart(
        'week',
        new Date('2026-01-01T00:00:00Z'),
      );
      expect(result.toISOString().slice(0, 10)).toBe('2025-12-29');
    });

    it('handles leap year Feb 2024', () => {
      const result = TimeBucketHelper.bucketStart(
        'month',
        new Date('2024-02-15T00:00:00Z'),
      );
      expect(result.toISOString().slice(0, 10)).toBe('2024-02-01');
    });
  });

  describe('intervalForPeriod()', () => {
    it('returns "1 day" for day', () => {
      expect(TimeBucketHelper.intervalForPeriod('day')).toBe('1 day');
    });

    it('returns "1 week" for week', () => {
      expect(TimeBucketHelper.intervalForPeriod('week')).toBe('1 week');
    });

    it('returns "1 month" for month', () => {
      expect(TimeBucketHelper.intervalForPeriod('month')).toBe('1 month');
    });
  });
});
