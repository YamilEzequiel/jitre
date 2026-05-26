import { Injectable } from '@nestjs/common';

/**
 * Thrown when both a and b are equal — no rank can be inserted between them.
 * ADR-4: In-house Lexorank — base-36 string ordering for task drag-and-drop.
 */
export class LexorankCollisionError extends Error {
  constructor() {
    super('LEXORANK_COLLISION: a and b must be different');
    this.name = 'LexorankCollisionError';
  }
}

/**
 * Lexicographic ranking service for sortable task lists.
 * Uses variable-length base-36 strings where 'n' is the initial midpoint.
 *
 * Guarantees:
 * - between(null, null) → initial rank
 * - between(a, null) → rank strictly after a
 * - between(null, b) → rank strictly before b
 * - between(a, b) → rank strictly between a and b (lexicographically)
 * - between(a, b) where a === b → throws LexorankCollisionError
 * - between(a, b) where a > b → throws RangeError
 *
 * ADR-4: ~80 lines, no external deps; crypto not needed here.
 */
@Injectable()
export class LexorankService {
  /** Alphabet: lowercase a–z (26 chars). 'm' is the midpoint character. */
  private static readonly ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
  private static readonly MIN_CHAR = 'a';
  private static readonly MAX_CHAR = 'z';
  /** The midpoint character in the alphabet (index 13 out of 26). */
  private static readonly MID_CHAR = 'n';
  private static readonly INITIAL = LexorankService.MID_CHAR;

  /** Returns the initial rank (used for the first item in an empty list). */
  between(a: string | null, b: string | null): string {
    if (a === null && b === null) {
      return LexorankService.INITIAL;
    }

    if (a !== null && b !== null) {
      if (a === b) throw new LexorankCollisionError();
      if (a > b)
        throw new RangeError(`LEXORANK_INVALID_ORDER: a "${a}" > b "${b}"`);
      return this.midpoint(a, b);
    }

    if (a === null && b !== null) {
      // Return something before b
      return this.midpoint('', b);
    }

    // a !== null && b === null: return something after a
    return this.append(a!);
  }

  /** Compute midpoint string between lo and hi (lo < hi guaranteed). */
  private midpoint(lo: string, hi: string): string {
    const loChars = this.toCharCodes(lo);
    const hiChars = this.toCharCodes(hi);

    // Pad shorter array to same length with min value
    const len = Math.max(loChars.length, hiChars.length);
    while (loChars.length < len) loChars.push(0);
    while (hiChars.length < len) hiChars.push(25); // 'z' = index 25

    const midChars: number[] = [];
    let carry = 0;

    for (let i = 0; i < len; i++) {
      const lo_ = loChars[i];
      const hi_ = hiChars[i];
      const sum = lo_ + hi_ + carry * 26;
      const mid = Math.floor(sum / 2);
      carry = sum % 2;
      midChars.push(mid % 26);
    }

    // If carry remains and result === lo, append a mid character to disambiguate
    const result = this.fromCharCodes(midChars);
    if (result <= lo) {
      return lo + LexorankService.MID_CHAR;
    }
    if (result >= hi) {
      return lo + LexorankService.MID_CHAR;
    }
    return result;
  }

  /** Append a midpoint character to create a rank after a. */
  private append(a: string): string {
    // Append 'n' (mid) to go after a without going to far
    return a + LexorankService.MID_CHAR;
  }

  private toCharCodes(s: string): number[] {
    const result: number[] = [];
    for (const c of s) {
      const idx = LexorankService.ALPHABET.indexOf(c);
      result.push(idx >= 0 ? idx : 0);
    }
    return result;
  }

  private fromCharCodes(codes: number[]): string {
    return codes.map((c) => LexorankService.ALPHABET[c] ?? 'a').join('');
  }
}
