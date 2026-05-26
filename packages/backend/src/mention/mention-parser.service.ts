import { Injectable } from '@nestjs/common';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MARKDOWN_MENTION_REGEX = /@\[([^\]]*)\]\(([^)]+)\)/g;
const BARE_MENTION_REGEX =
  /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

function isValidUuidV4(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

@Injectable()
export class MentionParser {
  parse(text: string): { userIds: string[] } {
    const seen = new Set<string>();
    const result: string[] = [];

    const markdownStripped = text.replace(
      MARKDOWN_MENTION_REGEX,
      (_match, _name, id) => {
        const normalized = id.trim();
        if (isValidUuidV4(normalized) && !seen.has(normalized.toLowerCase())) {
          seen.add(normalized.toLowerCase());
          result.push(normalized);
        }
        return '';
      },
    );

    const bareMatches = markdownStripped.matchAll(BARE_MENTION_REGEX);
    for (const match of bareMatches) {
      const id = match[1];
      if (isValidUuidV4(id) && !seen.has(id.toLowerCase())) {
        seen.add(id.toLowerCase());
        result.push(id);
      }
    }

    return { userIds: result };
  }
}
