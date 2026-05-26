import { MentionParser } from './mention-parser.service';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

describe('MentionParser', () => {
  let parser: MentionParser;

  beforeEach(() => {
    parser = new MentionParser();
  });

  it('parses markdown-style mention @[name](uuid)', () => {
    const result = parser.parse(`Hey @[Alice](${VALID_UUID}), see this`);
    expect(result.userIds).toEqual([VALID_UUID]);
  });

  it('parses bare mention @uuid', () => {
    const result = parser.parse(`@${VALID_UUID} please review`);
    expect(result.userIds).toEqual([VALID_UUID]);
  });

  it('de-duplicates the same uuid from multiple mentions', () => {
    const result = parser.parse(
      `@[Alice](${VALID_UUID}) and also @${VALID_UUID}`,
    );
    expect(result.userIds).toHaveLength(1);
    expect(result.userIds[0]).toBe(VALID_UUID);
  });

  it('preserves first-seen order across multiple unique uuids', () => {
    const result = parser.parse(`@${VALID_UUID} then @${VALID_UUID_2}`);
    expect(result.userIds).toEqual([VALID_UUID, VALID_UUID_2]);
  });

  it('discards invalid UUID strings', () => {
    const result = parser.parse('@not-a-uuid hello');
    expect(result.userIds).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    const result = parser.parse('');
    expect(result.userIds).toEqual([]);
  });

  it('returns empty array when no mentions present', () => {
    const result = parser.parse('Hello world, no mentions here');
    expect(result.userIds).toEqual([]);
  });

  it('handles multiple markdown and bare mentions mixed', () => {
    const result = parser.parse(
      `@[Bob](${VALID_UUID}) check @${VALID_UUID_2} and also @[Bob](${VALID_UUID})`,
    );
    expect(result.userIds).toEqual([VALID_UUID, VALID_UUID_2]);
  });

  it('validates uuid v4 format strictly (rejects v1)', () => {
    const v1Uuid = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const result = parser.parse(`@${v1Uuid}`);
    expect(result.userIds).toEqual([]);
  });
});
