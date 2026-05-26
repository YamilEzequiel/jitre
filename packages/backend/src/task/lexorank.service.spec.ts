import { LexorankService, LexorankCollisionError } from './lexorank.service';

describe('LexorankService', () => {
  let service: LexorankService;

  beforeEach(() => {
    service = new LexorankService();
  });

  describe('between(null, null)', () => {
    it('returns the initial rank', () => {
      const rank = service.between(null, null);
      expect(typeof rank).toBe('string');
      expect(rank.length).toBeGreaterThan(0);
    });
  });

  describe('between(null, b)', () => {
    it('returns a rank strictly before b', () => {
      const b = service.between(null, null); // initial rank ~'n'
      const rank = service.between(null, b);
      expect(rank < b).toBe(true);
    });
  });

  describe('between(a, null)', () => {
    it('returns a rank strictly after a', () => {
      const a = service.between(null, null); // initial rank
      const rank = service.between(a, null);
      expect(rank > a).toBe(true);
    });
  });

  describe('between(a, z)', () => {
    it('returns string strictly between a and z lexicographically', () => {
      const rank = service.between('a', 'z');
      expect(rank > 'a').toBe(true);
      expect(rank < 'z').toBe(true);
    });

    it('handles adjacent single chars', () => {
      const rank = service.between('a', 'b');
      expect(rank > 'a').toBe(true);
      expect(rank < 'b').toBe(true);
    });

    it('handles multi-char strings', () => {
      const rank = service.between('aaa', 'zzz');
      expect(rank > 'aaa').toBe(true);
      expect(rank < 'zzz').toBe(true);
    });
  });

  describe('collision error', () => {
    it('throws LexorankCollisionError when a === b', () => {
      expect(() => service.between('n', 'n')).toThrow(LexorankCollisionError);
    });
  });

  describe('ordering invariant', () => {
    it('produces a valid lexicographic sequence across 100 sequential insertions', () => {
      const ranks: string[] = [];
      let prev: string | null = null;

      for (let i = 0; i < 100; i++) {
        const rank = service.between(prev, null);
        ranks.push(rank);
        prev = rank;
      }

      // Verify monotonically increasing
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i] > ranks[i - 1]).toBe(true);
      }
    });

    it('stable when inserting between two existing ranks 50 times', () => {
      let lo = service.between(null, null);
      const hi = service.between(lo, null);

      for (let i = 0; i < 50; i++) {
        const mid = service.between(lo, hi);
        expect(mid > lo).toBe(true);
        expect(mid < hi).toBe(true);
        // Walk toward hi each time
        lo = mid;
      }
    });
  });

  describe('edge cases', () => {
    it('does not produce an infinite loop with very short strings', () => {
      // 'a' and 'b' are adjacent — between should still work or throw CollisionError
      const rank = service.between('a', 'b');
      expect(rank > 'a').toBe(true);
      expect(rank < 'b').toBe(true);
    });

    it('throws when a > b (invalid order)', () => {
      expect(() => service.between('z', 'a')).toThrow();
    });
  });
});
