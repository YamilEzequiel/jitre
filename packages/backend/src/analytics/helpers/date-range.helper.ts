import { BadRequestException } from '@nestjs/common';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Pure date-range validation helper.
 * Uses ANALYTICS_MAX_DATE_RANGE_DAYS env (default 365).
 */
export class DateRangeHelper {
  private static get maxDays(): number {
    const raw = process.env['ANALYTICS_MAX_DATE_RANGE_DAYS'];
    const parsed = raw ? parseInt(raw, 10) : 365;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 365;
  }

  static toDate(iso: string): Date {
    return new Date(iso);
  }

  static diffDays(from: string, to: string): number {
    const diff =
      DateRangeHelper.toDate(to).getTime() -
      DateRangeHelper.toDate(from).getTime();
    return Math.floor(diff / MS_PER_DAY);
  }

  /**
   * Validates that [from, to) is a valid, bounded range.
   * Throws BadRequestException with structured code on failure.
   */
  static validate(from: string, to: string): void {
    const fromMs = DateRangeHelper.toDate(from).getTime();
    const toMs = DateRangeHelper.toDate(to).getTime();
    const diffMs = toMs - fromMs;

    if (diffMs <= 0) {
      throw new BadRequestException({ code: 'INVALID_RANGE' });
    }

    const maxMs = DateRangeHelper.maxDays * MS_PER_DAY;
    if (diffMs > maxMs) {
      throw new BadRequestException({
        code: 'RANGE_TOO_LARGE',
        maxDays: DateRangeHelper.maxDays,
      });
    }
  }
}
