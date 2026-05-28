/**
 * Email layout primitive — produces both an HTML body and a plain-text
 * fallback from the same set of content blocks, so every email we send
 * has a consistent shell (header + footer) and a faithful text copy for
 * clients that strip HTML.
 *
 * Inline styles only: many email clients ignore `<style>` blocks.
 */

export interface EmailBlock {
  /**
   * Paragraph of body copy. Use `\n` for hard breaks inside the same
   * paragraph. Rendered as `<p>` in HTML and a blank-line-separated
   * paragraph in text.
   */
  paragraph?: string;

  /**
   * Compact key/value list — rendered as a definition list in HTML and
   * as `Key: Value` lines in text. Useful for "the facts" (task name,
   * due date, assignee, etc).
   */
  facts?: { label: string; value: string }[];

  /**
   * A pull-quote rendered with a left border. Use for the original
   * comment text in mentions/replies, or any user-generated snippet
   * that the body refers to.
   */
  quote?: string;
}

export interface RenderLayoutInput {
  /**
   * Hidden inbox-preview text (the "preheader"). Most clients show
   * ~90 chars next to the subject — use it to spoil the punchline.
   */
  preheader: string;
  /** Big heading at the top of the body. */
  title: string;
  /** First-line intro under the title, e.g. "Hi Alice, …". */
  intro: string;
  /** Ordered list of content blocks rendered between intro and footer. */
  blocks: EmailBlock[];
  /** Optional call-to-action button at the bottom of the body. */
  cta?: { label: string; url: string };
  /**
   * Footer reason line — e.g. "You're receiving this because task
   * assignment notifications are on." Lets the user trace back to
   * which setting controls this email.
   */
  reason: string;
  /** Workspace name shown in the header chip. Falls back to "Jitre". */
  workspaceName?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

const BRAND = 'Jitre';
const ACCENT = '#7c3aed'; // violet-600, matches the app accent.
const TEXT = '#0f172a'; // slate-950
const MUTED = '#64748b'; // slate-500
const BORDER = '#e2e8f0'; // slate-200
const BG_SOFT = '#f8fafc'; // slate-50

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBlocksHtml(blocks: EmailBlock[]): string {
  return blocks
    .map((block) => {
      if (block.paragraph) {
        const safe = escapeHtml(block.paragraph).replace(/\n/g, '<br>');
        return `<p style="margin:0 0 16px;color:${TEXT};font-size:15px;line-height:1.55;">${safe}</p>`;
      }
      if (block.facts && block.facts.length > 0) {
        const rows = block.facts
          .map(
            (f) =>
              `<tr><td style="padding:6px 12px 6px 0;color:${MUTED};font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(f.label)}</td><td style="padding:6px 0;color:${TEXT};font-size:14px;vertical-align:top;">${escapeHtml(f.value)}</td></tr>`,
          )
          .join('');
        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid ${BORDER};border-radius:8px;background:${BG_SOFT};width:100%;"><tbody>${rows}</tbody></table>`;
      }
      if (block.quote) {
        const safe = escapeHtml(block.quote).replace(/\n/g, '<br>');
        return `<blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid ${ACCENT};background:${BG_SOFT};color:${TEXT};font-size:14px;line-height:1.55;border-radius:0 6px 6px 0;">${safe}</blockquote>`;
      }
      return '';
    })
    .join('');
}

function renderBlocksText(blocks: EmailBlock[]): string {
  return blocks
    .map((block) => {
      if (block.paragraph) return block.paragraph;
      if (block.facts && block.facts.length > 0) {
        return block.facts.map((f) => `${f.label}: ${f.value}`).join('\n');
      }
      if (block.quote) {
        return block.quote
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n');
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

export function renderLayout(input: RenderLayoutInput): RenderedEmail {
  const workspace = input.workspaceName?.trim() || BRAND;
  const safePreheader = escapeHtml(input.preheader);
  const safeTitle = escapeHtml(input.title);
  const safeIntro = escapeHtml(input.intro);
  const safeWorkspace = escapeHtml(workspace);
  const safeReason = escapeHtml(input.reason);

  const ctaHtml = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background:${ACCENT};"><a href="${encodeURI(input.cta.url)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${escapeHtml(input.cta.label)}</a></td></tr></table>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:${BG_SOFT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${TEXT};">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;">${safePreheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_SOFT};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:14px;overflow:hidden;">
      <tr><td style="padding:18px 24px;border-bottom:1px solid ${BORDER};background:#ffffff;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:15px;font-weight:700;letter-spacing:-0.01em;color:${TEXT};">${BRAND}</td>
            <td align="right" style="font-size:12px;color:${MUTED};">
              <span style="display:inline-block;padding:4px 10px;border:1px solid ${BORDER};border-radius:999px;background:${BG_SOFT};">${safeWorkspace}</span>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:28px 28px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;color:${TEXT};">${safeTitle}</h1>
        <p style="margin:0 0 20px;color:${MUTED};font-size:14px;line-height:1.55;">${safeIntro}</p>
        ${renderBlocksHtml(input.blocks)}
        ${ctaHtml}
      </td></tr>
      <tr><td style="padding:18px 28px 24px;border-top:1px solid ${BORDER};background:${BG_SOFT};">
        <p style="margin:0 0 6px;color:${MUTED};font-size:12px;line-height:1.5;">${safeReason}</p>
        <p style="margin:0;color:${MUTED};font-size:12px;line-height:1.5;">Manage your notification preferences in <strong>Settings → Notifications</strong>.</p>
      </td></tr>
    </table>
    <p style="margin:14px 0 0;color:${MUTED};font-size:11px;text-align:center;">Sent by ${BRAND} on behalf of ${safeWorkspace}.</p>
  </td></tr>
</table>
</body>
</html>`;

  const textParts: string[] = [];
  textParts.push(`${BRAND} — ${workspace}`);
  textParts.push(''.padEnd(40, '─'));
  textParts.push(input.title);
  textParts.push('');
  textParts.push(input.intro);
  const blocksText = renderBlocksText(input.blocks);
  if (blocksText) {
    textParts.push('');
    textParts.push(blocksText);
  }
  if (input.cta) {
    textParts.push('');
    textParts.push(`${input.cta.label}: ${input.cta.url}`);
  }
  textParts.push('');
  textParts.push(''.padEnd(40, '─'));
  textParts.push(input.reason);
  textParts.push(
    'Manage your notification preferences in Settings → Notifications.',
  );

  return { html, text: textParts.join('\n') };
}
