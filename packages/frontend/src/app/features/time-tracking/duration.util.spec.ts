import { describe, it, expect } from 'vitest';
import { parseDurationToMinutes, formatMinutes, formatTimerSeconds } from './duration.util';

describe('parseDurationToMinutes', () => {
  it('parses "1h 30m" as 90', () => {
    expect(parseDurationToMinutes('1h 30m')).toBe(90);
  });

  it('parses "1h30m" as 90 (no space)', () => {
    expect(parseDurationToMinutes('1h30m')).toBe(90);
  });

  it('parses decimal hours "1.5h" as 90', () => {
    expect(parseDurationToMinutes('1.5h')).toBe(90);
  });

  it('parses "90m" as 90', () => {
    expect(parseDurationToMinutes('90m')).toBe(90);
  });

  it('parses bare number "90" as 90', () => {
    expect(parseDurationToMinutes('90')).toBe(90);
  });

  it('parses "2h" as 120', () => {
    expect(parseDurationToMinutes('2h')).toBe(120);
  });

  it('parses ".5h" as 30', () => {
    expect(parseDurationToMinutes('.5h')).toBe(30);
  });

  it('is case-insensitive', () => {
    expect(parseDurationToMinutes('1H 30M')).toBe(90);
  });

  it('returns null for empty string', () => {
    expect(parseDurationToMinutes('')).toBeNull();
    expect(parseDurationToMinutes('   ')).toBeNull();
  });

  it('returns null for invalid text', () => {
    expect(parseDurationToMinutes('abc')).toBeNull();
    expect(parseDurationToMinutes('1x')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(parseDurationToMinutes(null)).toBeNull();
    expect(parseDurationToMinutes(undefined)).toBeNull();
  });

  it('returns null for zero or negative input', () => {
    expect(parseDurationToMinutes('0')).toBeNull();
    expect(parseDurationToMinutes('0h 0m')).toBeNull();
  });
});

describe('formatMinutes', () => {
  it('formats hours+minutes as "Xh Ym"', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
  });

  it('formats whole hours as "Xh"', () => {
    expect(formatMinutes(120)).toBe('2h');
  });

  it('formats sub-hour minutes as "Ym"', () => {
    expect(formatMinutes(45)).toBe('45m');
  });

  it('returns "0m" for zero or negative input', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(-5)).toBe('0m');
  });
});

describe('formatTimerSeconds', () => {
  it('formats H:MM:SS for seconds', () => {
    expect(formatTimerSeconds(0)).toBe('0:00:00');
    expect(formatTimerSeconds(65)).toBe('0:01:05');
    expect(formatTimerSeconds(3725)).toBe('1:02:05');
  });

  it('clamps negative to zero', () => {
    expect(formatTimerSeconds(-100)).toBe('0:00:00');
  });
});
