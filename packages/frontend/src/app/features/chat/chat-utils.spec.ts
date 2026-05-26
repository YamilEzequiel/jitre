import {
  hashHue,
  initialsFor,
  shortId,
  otherUserIdFromDmName,
  shouldGroupWith,
  formatRelative,
} from './chat-utils';

describe('chat-utils', () => {
  it('hashHue is deterministic and within 0..359', () => {
    const a = hashHue('user-alpha');
    const b = hashHue('user-alpha');
    const c = hashHue('user-beta');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(360);
    expect(a).not.toBe(c);
  });

  it('initialsFor splits on separators and takes first letters', () => {
    expect(initialsFor('alice.smith')).toBe('AS');
    expect(initialsFor('bob jones')).toBe('BJ');
    expect(initialsFor('z')).toBe('Z');
  });

  it('shortId truncates to default length', () => {
    expect(shortId('1234567890abcdef')).toBe('12345678');
    expect(shortId('xy')).toBe('xy');
  });

  it('otherUserIdFromDmName extracts the other participant', () => {
    expect(otherUserIdFromDmName('dm:u1:u2', 'u1')).toBe('u2');
    expect(otherUserIdFromDmName('dm:u1:u2', 'u2')).toBe('u1');
    expect(otherUserIdFromDmName('design', 'u1')).toBeNull();
  });

  it('shouldGroupWith groups same author within 5 minutes', () => {
    const t1 = '2026-01-01T10:00:00Z';
    const t2 = '2026-01-01T10:03:00Z';
    const t3 = '2026-01-01T10:10:00Z';
    expect(shouldGroupWith({ authorId: 'u1', createdAt: t1 }, { authorId: 'u1', createdAt: t2 })).toBe(true);
    expect(shouldGroupWith({ authorId: 'u1', createdAt: t1 }, { authorId: 'u1', createdAt: t3 })).toBe(false);
    expect(shouldGroupWith({ authorId: 'u1', createdAt: t1 }, { authorId: 'u2', createdAt: t2 })).toBe(false);
    expect(shouldGroupWith(null, { authorId: 'u1', createdAt: t1 })).toBe(false);
  });

  it('formatRelative returns "just now" for very recent', () => {
    const now = Date.now();
    const iso = new Date(now - 10_000).toISOString();
    expect(formatRelative(iso, now)).toBe('just now');
  });

  it('formatRelative formats minutes and hours', () => {
    const now = Date.now();
    expect(formatRelative(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5m');
    expect(formatRelative(new Date(now - 3 * 3600_000).toISOString(), now)).toBe('3h');
  });
});
