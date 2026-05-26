export interface CommentForSummary {
  authorId: string;
  body: string;
  createdAt: Date;
}

/** Max approximate tokens to send (~6000 tokens ≈ ~24000 chars) */
const MAX_PROMPT_CHARS = 24_000;

export function buildSummaryPrompt(comments: CommentForSummary[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt =
    'You are a project management assistant. Summarize the following comments concisely in 2-4 sentences, focusing on decisions made, blockers identified, and action items. Return plain text only.';

  const commentLines = comments.map(
    (c, i) =>
      `[${i + 1}] (${c.createdAt.toISOString().slice(0, 10)}): ${c.body}`,
  );

  let userPrompt = `Comments to summarize:\n\n${commentLines.join('\n\n')}`;

  // Cap at max chars
  if (userPrompt.length > MAX_PROMPT_CHARS) {
    userPrompt = userPrompt.slice(0, MAX_PROMPT_CHARS) + '\n...[truncated]';
  }

  return { systemPrompt, userPrompt };
}
