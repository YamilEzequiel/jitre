/**
 * Builds PostgreSQL percentile_cont SQL fragment.
 * ADR-1: percentile_cont (exact/interpolated) preferred over percentile_disc.
 */
export class PercentileHelper {
  /**
   * Generates: percentile_cont(<p>) WITHIN GROUP (ORDER BY <column>)
   */
  static expr(p: number, column: string): string {
    return `percentile_cont(${p}) WITHIN GROUP (ORDER BY ${column})`;
  }
}
