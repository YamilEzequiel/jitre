import { scrubSensitive } from './scrub-sensitive.util';

describe('scrubSensitive', () => {
  it('redacts password key', () => {
    const result = scrubSensitive({
      password: 'secret123',
      name: 'alice',
    }) as Record<string, unknown>;
    expect(result['password']).toBe('[REDACTED]');
    expect(result['name']).toBe('alice');
  });

  it('redacts passwordHash key', () => {
    const result = scrubSensitive({ passwordHash: 'hashed' }) as Record<
      string,
      unknown
    >;
    expect(result['passwordHash']).toBe('[REDACTED]');
  });

  it('redacts token key', () => {
    const result = scrubSensitive({ accessToken: 'tok' }) as Record<
      string,
      unknown
    >;
    expect(result['accessToken']).toBe('[REDACTED]');
  });

  it('redacts secret key', () => {
    const result = scrubSensitive({ mySecret: 'shh' }) as Record<
      string,
      unknown
    >;
    expect(result['mySecret']).toBe('[REDACTED]');
  });

  it('redacts apiKey key', () => {
    const result = scrubSensitive({ apiKey: 'k1' }) as Record<string, unknown>;
    expect(result['apiKey']).toBe('[REDACTED]');
  });

  it('redacts api_key key', () => {
    const result = scrubSensitive({ api_key: 'k2' }) as Record<string, unknown>;
    expect(result['api_key']).toBe('[REDACTED]');
  });

  it('redacts authorization key', () => {
    const result = scrubSensitive({ authorization: 'Bearer xyz' }) as Record<
      string,
      unknown
    >;
    expect(result['authorization']).toBe('[REDACTED]');
  });

  it('is case-insensitive on key names', () => {
    const result = scrubSensitive({ PASSWORD: 'val' }) as Record<
      string,
      unknown
    >;
    expect(result['PASSWORD']).toBe('[REDACTED]');
  });

  it('scrubs nested objects recursively', () => {
    const input = {
      user: { email: 'a@b.com', passwordHash: 'X' },
      accessToken: 'Y',
      items: [{ apiKey: 'Z' }],
    };
    const result = scrubSensitive(input) as Record<string, unknown>;
    const user = result['user'] as Record<string, unknown>;
    expect(user['email']).toBe('a@b.com');
    expect(user['passwordHash']).toBe('[REDACTED]');
    expect(result['accessToken']).toBe('[REDACTED]');
    const items = result['items'] as Record<string, unknown>[];
    expect(items[0]['apiKey']).toBe('[REDACTED]');
  });

  it('preserves Date objects', () => {
    const d = new Date('2024-01-01');
    const result = scrubSensitive({ when: d }) as Record<string, unknown>;
    expect(result['when']).toBe(d);
  });

  it('preserves number primitives', () => {
    const result = scrubSensitive({ count: 42 }) as Record<string, unknown>;
    expect(result['count']).toBe(42);
  });

  it('preserves string primitives on safe keys', () => {
    const result = scrubSensitive({ label: 'ok' }) as Record<string, unknown>;
    expect(result['label']).toBe('ok');
  });

  it('does not mutate the original input', () => {
    const input = { password: 'secret' };
    scrubSensitive(input);
    expect(input.password).toBe('secret');
  });

  it('handles circular references without throwing', () => {
    const o: Record<string, unknown> = { a: 1 };
    o['self'] = o;
    let result: Record<string, unknown> | undefined;
    expect(() => {
      result = scrubSensitive(o) as Record<string, unknown>;
    }).not.toThrow();
    expect(result!['self']).toBe('[CIRCULAR]');
  });

  it('handles arrays at the top level', () => {
    const arr = [{ password: 'p1' }, { email: 'a@b.com' }];
    const result = scrubSensitive(arr) as Record<string, unknown>[];
    expect(result[0]['password']).toBe('[REDACTED]');
    expect(result[1]['email']).toBe('a@b.com');
  });

  it('returns primitives as-is', () => {
    expect(scrubSensitive(42)).toBe(42);
    expect(scrubSensitive('hello')).toBe('hello');
    expect(scrubSensitive(null)).toBeNull();
  });
});
