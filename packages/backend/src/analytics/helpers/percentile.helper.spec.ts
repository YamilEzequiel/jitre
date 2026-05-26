import { PercentileHelper } from './percentile.helper';

describe('PercentileHelper', () => {
  describe('expr()', () => {
    it('generates percentile_cont(0.5) expression', () => {
      const result = PercentileHelper.expr(0.5, 'duration_sec');
      expect(result).toContain('percentile_cont(0.5)');
      expect(result).toContain('WITHIN GROUP');
      expect(result).toContain('ORDER BY duration_sec');
    });

    it('generates percentile_cont(0.75) expression', () => {
      const result = PercentileHelper.expr(0.75, 'duration_sec');
      expect(result).toContain('percentile_cont(0.75)');
    });

    it('generates percentile_cont(0.95) expression', () => {
      const result = PercentileHelper.expr(0.95, 'duration_sec');
      expect(result).toContain('percentile_cont(0.95)');
    });

    it('uses the provided column name', () => {
      const result = PercentileHelper.expr(0.5, 'cycle_time_sec');
      expect(result).toContain('cycle_time_sec');
    });

    it('generates valid SQL fragment (no semicolons, balanced parens)', () => {
      const result = PercentileHelper.expr(0.5, 'duration_sec');
      expect(result).not.toContain(';');
      // count open and close parens — should be equal
      const opens = (result.match(/\(/g) ?? []).length;
      const closes = (result.match(/\)/g) ?? []).length;
      expect(opens).toBe(closes);
    });
  });
});
