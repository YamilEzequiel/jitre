import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignKeyResult {
  token: string;
  expiresAt: number;
}

export function signKey(
  key: string,
  ttlSeconds: number,
  secret: string,
): SignKeyResult {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${key}|${expiresAt}`;
  const token = createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  return { token, expiresAt };
}

export function verifySignature(
  key: string,
  token: string,
  expiresAtEpoch: number,
  secret: string,
): boolean {
  if (expiresAtEpoch < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const payload = `${key}|${expiresAtEpoch}`;
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  const expectedBuf = Buffer.from(expected);
  const tokenBuf = Buffer.from(token);

  if (expectedBuf.length !== tokenBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, tokenBuf);
}
