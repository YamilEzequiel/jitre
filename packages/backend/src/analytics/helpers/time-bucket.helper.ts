export type AnalyticsPeriod = 'day' | 'week' | 'month';

/**
 * Pure helper for time-bucket semantics.
 * UTC + ISO 8601 Monday-start week (ADR-2).
 */
export class TimeBucketHelper {
  /**
   * PostgreSQL format string for to_char() / TO_CHAR() output.
   * Determines the bucket label in JSON responses.
   */
  static formatForPeriod(period: AnalyticsPeriod): string {
    switch (period) {
      case 'day':
        return 'YYYY-MM-DD';
      case 'week':
        return 'IYYY-"W"IW';
      case 'month':
        return 'YYYY-MM';
    }
  }

  /**
   * SQL date_trunc expression anchored to UTC.
   *
   * Example output:
   *   date_trunc('week', occurred_at AT TIME ZONE 'UTC')
   */
  static dateTruncExpr(period: AnalyticsPeriod, column: string): string {
    return `date_trunc('${period}', ${column} AT TIME ZONE 'UTC')`;
  }

  /**
   * PostgreSQL INTERVAL string for generate_series step.
   */
  static intervalForPeriod(period: AnalyticsPeriod): string {
    switch (period) {
      case 'day':
        return '1 day';
      case 'week':
        return '1 week';
      case 'month':
        return '1 month';
    }
  }

  /**
   * Compute the bucket start date for a given period in UTC.
   * - 'day'   → midnight UTC of that day
   * - 'week'  → ISO 8601 Monday 00:00:00 UTC
   * - 'month' → 1st of month 00:00:00 UTC
   */
  static bucketStart(period: AnalyticsPeriod, date: Date): Date {
    const d = new Date(date);
    switch (period) {
      case 'day': {
        d.setUTCHours(0, 0, 0, 0);
        return d;
      }
      case 'week': {
        d.setUTCHours(0, 0, 0, 0);
        // ISO 8601: Monday = 1, Sunday = 0 → Sunday offset = 6
        const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        d.setUTCDate(d.getUTCDate() - offset);
        return d;
      }
      case 'month': {
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      }
    }
  }
}
