import { BadRequestException } from '@nestjs/common';
import { DateRangeHelper } from './date-range.helper';

describe('DateRangeHelper', () => {
  describe('validate()', () => {
    it('accepts exactly 365 days (inclusive)', () => {
      expect(() =>
        DateRangeHelper.validate('2026-01-01', '2026-12-31'),
      ).not.toThrow();
    });

    it('throws RANGE_TOO_LARGE for 366-day range', () => {
      try {
        DateRangeHelper.validate('2026-01-01', '2027-01-02');
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getResponse()).toMatchObject({
          code: 'RANGE_TOO_LARGE',
          maxDays: 365,
        });
      }
    });

    it('throws INVALID_RANGE when from === to', () => {
      try {
        DateRangeHelper.validate('2026-05-01', '2026-05-01');
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getResponse()).toMatchObject({
          code: 'INVALID_RANGE',
        });
      }
    });

    it('throws INVALID_RANGE when from > to', () => {
      try {
        DateRangeHelper.validate('2026-05-10', '2026-05-01');
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getResponse()).toMatchObject({
          code: 'INVALID_RANGE',
        });
      }
    });

    it('accepts 1-day range (from < to by 1 day)', () => {
      expect(() =>
        DateRangeHelper.validate('2026-05-01', '2026-05-02'),
      ).not.toThrow();
    });

    it('parses ISO 8601 strings correctly', () => {
      expect(() =>
        DateRangeHelper.validate(
          '2026-05-01T00:00:00Z',
          '2026-05-31T00:00:00Z',
        ),
      ).not.toThrow();
    });
  });

  describe('diffDays()', () => {
    it('returns 0 for same timestamps', () => {
      expect(DateRangeHelper.diffDays('2026-05-01', '2026-05-01')).toBe(0);
    });

    it('returns 1 for consecutive days', () => {
      expect(DateRangeHelper.diffDays('2026-05-01', '2026-05-02')).toBe(1);
    });

    it('returns 365 for a full year (non-leap year)', () => {
      expect(DateRangeHelper.diffDays('2026-01-01', '2026-12-31')).toBe(364);
    });
  });

  describe('toDate()', () => {
    it('parses ISO 8601 date string', () => {
      const d = DateRangeHelper.toDate('2026-05-01');
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(4); // May
      expect(d.getUTCDate()).toBe(1);
    });
  });
});
