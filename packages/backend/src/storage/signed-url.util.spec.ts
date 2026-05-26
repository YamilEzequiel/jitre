import { signKey, verifySignature } from './signed-url.util';

describe('signKey / verifySignature', () => {
  const secret = 'test-secret-32-chars-padding-here!';
  const key = 'workspaces/W1/comment/C1/A1-test.txt';

  it('roundtrip succeeds', () => {
    const { token, expiresAt } = signKey(key, 300, secret);
    expect(verifySignature(key, token, expiresAt, secret)).toBe(true);
  });

  it('rejects tampered key', () => {
    const { token, expiresAt } = signKey(key, 300, secret);
    expect(verifySignature(key + '-tampered', token, expiresAt, secret)).toBe(
      false,
    );
  });

  it('rejects expired token', () => {
    const pastEpoch = Math.floor(Date.now() / 1000) - 10;
    const { token } = signKey(key, -10, secret);
    expect(verifySignature(key, token, pastEpoch, secret)).toBe(false);
  });

  it('rejects wrong secret', () => {
    const { token, expiresAt } = signKey(key, 300, 'secret1');
    expect(verifySignature(key, token, expiresAt, 'secret2')).toBe(false);
  });

  it('handles unequal token lengths safely (no exception)', () => {
    const { expiresAt } = signKey(key, 300, secret);
    const shortToken = 'abc';
    expect(() =>
      verifySignature(key, shortToken, expiresAt, secret),
    ).not.toThrow();
    expect(verifySignature(key, shortToken, expiresAt, secret)).toBe(false);
  });

  it('token is a valid base64url string', () => {
    const { token } = signKey(key, 300, secret);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
