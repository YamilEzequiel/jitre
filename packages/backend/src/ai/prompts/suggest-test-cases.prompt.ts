import type { AiPromptTemplateEntity } from '../prompt-template/ai-prompt-template.entity';
import { languageDirective } from './locale.util';

export interface SuggestTestCasesContext {
  taskTitle: string;
  taskDescription?: string | null;
  maxSuggestions: number;
  locale?: string;
}

export const SUGGEST_TEST_CASES_TEMPLATE_VARIABLES = [
  'taskTitle',
  'taskDescription',
  'maxSuggestions',
] as const;

function interpolate(
  template: string,
  vars: Record<string, string | number | undefined>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function buildSuggestTestCasesPrompt(
  ctx: SuggestTestCasesContext,
  template?: Pick<AiPromptTemplateEntity, 'systemPrompt' | 'userTemplate'> | null,
): { systemPrompt: string; userPrompt: string } {
  if (template) {
    const vars = {
      taskTitle: ctx.taskTitle,
      taskDescription: ctx.taskDescription ?? '',
      maxSuggestions: ctx.maxSuggestions,
    };
    return {
      systemPrompt: interpolate(template.systemPrompt, vars),
      userPrompt: interpolate(template.userTemplate, vars),
    };
  }

  const systemPrompt =
    'You are a senior QA engineer. Given a task, propose realistic, executable test cases that cover the happy path and the most likely failure modes. ' +
    'You MUST return ONLY a JSON object with this exact top-level shape (use camelCase, do not rename keys): ' +
    '{"testCases":[{"title":"string","precondition":"string","steps":"string","expected":"string"}]}. ' +
    'Do not use snake_case (no `test_cases`). Do not return a top-level array. Do not wrap in markdown fences. Do not add prose before or after. ' +
    'Each field is plain text (markdown bullets allowed in `steps`). `title` is short (max 120 chars). ' +
    `Generate at most ${ctx.maxSuggestions} test cases.` +
    languageDirective(ctx.locale ?? 'en');

  const lines = [`Task: ${ctx.taskTitle}`];
  if (ctx.taskDescription) lines.push(`Description: ${ctx.taskDescription}`);
  lines.push(
    `Produce ${ctx.maxSuggestions} test cases covering happy path, edge cases and likely regressions.`,
  );

  return { systemPrompt, userPrompt: lines.join('\n') };
}

export interface TestCaseSuggestion {
  title: string;
  precondition?: string;
  steps?: string;
  expected?: string;
}

/**
 * Coerce a raw item (whatever shape the model chose) into a TestCaseSuggestion.
 * Handles common variants: camelCase, snake_case, capitalized BDD keywords,
 * `name` instead of `title`, etc. Returns null if no usable title can be found.
 */
function coerceItem(raw: unknown): TestCaseSuggestion | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = r[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  };

  const title = pick('title', 'name', 'scenario', 'case', 'description');
  if (!title) return null;

  return {
    title,
    precondition: pick(
      'precondition',
      'preconditions',
      'given',
      'Given',
      'setup',
      'context',
    ),
    steps: pick('steps', 'when', 'When', 'actions', 'action', 'do'),
    expected: pick(
      'expected',
      'expectedResult',
      'expected_result',
      'then',
      'Then',
      'result',
      'outcome',
    ),
  };
}

/**
 * Parse the AI response. Accepts many shapes because providers + models are
 * inconsistent: `{ testCases: [...] }`, `{ test_cases: [...] }`, `{ cases: [...] }`,
 * `{ items: [...] }`, a top-level array, or even prose wrapping any of the above.
 *
 * Returns an empty array if nothing usable is found — caller decides whether
 * that should be a 502 or a soft error.
 */
export function parseTestCasesResponse(
  text: string,
  maxSuggestions: number,
): TestCaseSuggestion[] {
  const CANDIDATE_KEYS = [
    'testCases',
    'test_cases',
    'testcases',
    'cases',
    'items',
    'suggestions',
    'tests',
    'scenarios',
  ];

  const extractArray = (parsed: unknown): unknown[] | null => {
    if (Array.isArray(parsed)) return parsed;
    if (parsed === null || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    for (const k of CANDIDATE_KEYS) {
      if (Array.isArray(obj[k])) return obj[k] as unknown[];
    }
    // Last resort: take the first array value at the top level.
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) return v;
    }
    return null;
  };

  const tryParse = (raw: string): TestCaseSuggestion[] | null => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    const arr = extractArray(parsed);
    if (!arr) return null;
    const cases = arr
      .map((it) => coerceItem(it))
      .filter((it): it is TestCaseSuggestion => it !== null)
      .slice(0, maxSuggestions);
    return cases.length > 0 ? cases : null;
  };

  // Pass 1: parse as-is.
  const direct = tryParse(text);
  if (direct) return direct;

  // Pass 2: strip ```json fences.
  const fenced = text.match(/```(?:json|JSON)?\s*([\s\S]+?)```/);
  if (fenced) {
    const inner = tryParse(fenced[1]);
    if (inner) return inner;
  }

  // Pass 3: extract the first JSON object/array substring out of prose.
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    const inner = tryParse(objMatch[0]);
    if (inner) return inner;
  }
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    const inner = tryParse(arrMatch[0]);
    if (inner) return inner;
  }

  // Pass 4: response was truncated mid-array (MAX_TOKENS). Walk the text and
  // extract every complete top-level `{ ... }` object inside the array we can
  // find — drop the last one because it's almost certainly incomplete.
  const salvaged = salvageCompleteObjects(text);
  if (salvaged.length > 0) {
    const cases = salvaged
      .map((it) => coerceItem(it))
      .filter((it): it is TestCaseSuggestion => it !== null)
      .slice(0, maxSuggestions);
    if (cases.length > 0) return cases;
  }

  return [];
}

/**
 * Walks `text` character by character, tracking string state and brace depth,
 * and returns every complete top-level object it finds inside any array (or
 * at the outermost level). Used to rescue test cases when the model's JSON
 * response was cut off by a maxTokens budget.
 */
function salvageCompleteObjects(text: string): unknown[] {
  const out: unknown[] = [];
  let i = 0;
  while (i < text.length) {
    // Skip until the next '{'.
    while (i < text.length && text[i] !== '{') i++;
    if (i >= text.length) break;

    const start = i;
    let depth = 0;
    let inString = false;
    let escape = false;
    let closed = false;

    for (; i < text.length; i++) {
      const c = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          const slice = text.slice(start, i + 1);
          try {
            const parsed = JSON.parse(slice) as unknown;
            // Ignore the outer wrapper `{ testCases: [...] }` — we want
            // individual items, which look like `{ title: ..., ... }`.
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              const obj = parsed as Record<string, unknown>;
              const looksLikeItem =
                typeof obj['title'] === 'string' ||
                typeof obj['name'] === 'string' ||
                typeof obj['scenario'] === 'string';
              if (looksLikeItem) out.push(parsed);
            }
          } catch {
            // Malformed slice — skip and keep scanning.
          }
          i++;
          closed = true;
          break;
        }
      }
    }
    if (!closed) break; // Hit truncation; nothing more usable ahead.
  }
  return out;
}
