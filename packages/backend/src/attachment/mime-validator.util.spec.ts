import {
  validateAvatarMime,
  validateAttachmentMime,
  AVATAR_ALLOWED_MIMES,
  ATTACHMENT_ALLOWED_MIMES,
} from './mime-validator.util';

function makePngBuffer(): Buffer {
  const buf = Buffer.alloc(100, 0);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;
  buf[8] = 0;
  buf[9] = 0;
  buf[10] = 0;
  buf[11] = 13;
  buf[12] = 0x49;
  buf[13] = 0x48;
  buf[14] = 0x44;
  buf[15] = 0x52;
  return buf;
}

function makeJpegBuffer(): Buffer {
  const buf = Buffer.alloc(100, 0);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  return buf;
}

function makeTextBuffer(): Buffer {
  return Buffer.from('This is a plain text document');
}

describe('validateAvatarMime', () => {
  it('accepts PNG buffer with image/png declared mime', async () => {
    const result = await validateAvatarMime(makePngBuffer(), 'image/png');
    expect(result.valid).toBe(true);
  });

  it('accepts JPEG buffer with image/jpeg declared mime', async () => {
    const result = await validateAvatarMime(makeJpegBuffer(), 'image/jpeg');
    expect(result.valid).toBe(true);
  });

  it('rejects when magic bytes do not match declared mime', async () => {
    const result = await validateAvatarMime(makeTextBuffer(), 'image/png');
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('rejects mime types not in avatar allowlist', async () => {
    const result = await validateAvatarMime(makePngBuffer(), 'application/pdf');
    expect(result.valid).toBe(false);
  });

  it('exports AVATAR_ALLOWED_MIMES', () => {
    expect(AVATAR_ALLOWED_MIMES).toContain('image/png');
    expect(AVATAR_ALLOWED_MIMES).toContain('image/jpeg');
    expect(AVATAR_ALLOWED_MIMES).toContain('image/webp');
  });
});

describe('validateAttachmentMime', () => {
  it('accepts PNG buffer with image/png declared mime', async () => {
    const result = await validateAttachmentMime(makePngBuffer(), 'image/png');
    expect(result.valid).toBe(true);
  });

  it('rejects when magic bytes mismatch', async () => {
    const result = await validateAttachmentMime(makeTextBuffer(), 'image/png');
    expect(result.valid).toBe(false);
  });

  it('rejects mime types not in attachment allowlist', async () => {
    const result = await validateAttachmentMime(
      makePngBuffer(),
      'application/x-shockwave-flash',
    );
    expect(result.valid).toBe(false);
  });

  it('exports ATTACHMENT_ALLOWED_MIMES', () => {
    expect(ATTACHMENT_ALLOWED_MIMES.length).toBeGreaterThan(0);
  });
});
