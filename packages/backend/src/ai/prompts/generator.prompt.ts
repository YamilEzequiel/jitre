import {
  AiDocDraft,
  AiGeneratorDraft,
  AiGeneratorDraftKind,
  AiProjectDraft,
  AiTaskDraft,
  AiTaskWithSubtasksDraft,
} from '@jitre/shared';
import { TaskPriority } from '@jitre/shared';

const ALLOWED_KINDS: AiGeneratorDraftKind[] = [
  'task',
  'task_with_subtasks',
  'doc',
  'project',
];
const ALLOWED_PRIORITIES = new Set<TaskPriority>([
  TaskPriority.LOW,
  TaskPriority.MEDIUM,
  TaskPriority.HIGH,
  TaskPriority.URGENT,
]);

/**
 * System prompt:
 * - Locks the model to one of the supported `kind` values.
 * - Forces a JSON-only response (no prose, no markdown fences).
 * - Provides the exact schema the parser will validate against.
 */
export function buildGeneratorSystemPrompt(): string {
  return [
    'You convert user requests into ONE structured draft for a project-management tool.',
    'Return ONLY a single JSON object. No prose, no markdown fences, no comments.',
    '',
    'Choose exactly ONE of these `kind` values:',
    '  - "task": the user wants a single task.',
    '  - "task_with_subtasks": the user wants a parent task split into ≤ 8 actionable subtasks.',
    '  - "doc": the user wants a wiki/documentation page.',
    '  - "project": the user wants to create a new project / workspace area.',
    '',
    'Schemas:',
    '',
    '  task:',
    '    { "kind": "task",',
    '      "title": string,                              // <= 120 chars, imperative voice',
    '      "description": string | null,                 // optional, brief paragraph',
    '      "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null,',
    '      "labels": string[]                            // up to 5, lowercase short tags',
    '    }',
    '',
    '  task_with_subtasks:',
    '    { "kind": "task_with_subtasks",',
    '      "parent": { "title": string, "description": string | null,',
    '                  "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null,',
    '                  "labels": string[] },',
    '      "subtasks": Array<{ "title": string, "description": string | null }>',
    '    }',
    '',
    '  doc:',
    '    { "kind": "doc",',
    '      "title": string,                              // page title',
    '      "icon": string | null,                        // optional single emoji',
    '      "body": string | null                         // plain text, paragraphs separated by \\n\\n',
    '    }',
    '',
    '  project:',
    '    { "kind": "project",',
    '      "name": string,                               // human readable',
    '      "key": string,                                // 3-5 uppercase chars, derived from name',
    '      "description": string | null,',
    '      "icon": string | null,                        // optional single emoji',
    '      "color": string | null                        // optional hex like "#6366F1"',
    '    }',
    '',
    'Rules:',
    '  - Never invent ids, dates, assignees, or project names.',
    '  - Skip fields you are not confident about (omit or use null).',
    '  - If the request is ambiguous, prefer "task".',
    '  - If the request mentions multiple steps or "break down" / "plan", prefer "task_with_subtasks".',
    '  - If the request mentions "wiki", "page", "doc", "notes", or "write up", prefer "doc".',
    '  - If the request mentions "new project", "create a project", or "start an initiative", prefer "project".',
    '  - For "project", derive `key` from the name (first letters of significant words, uppercase, 3-5 chars).',
  ].join('\n');
}

export interface GeneratorPromptContext {
  prompt: string;
  /** When set, hint the model that the draft will be filed under this project. */
  projectName?: string | null;
}

export function buildGeneratorUserPrompt(ctx: GeneratorPromptContext): string {
  const lines: string[] = [];
  if (ctx.projectName) {
    lines.push(`Active project: ${ctx.projectName}`);
  }
  lines.push(`User request: ${ctx.prompt.trim()}`);
  return lines.join('\n');
}

/**
 * Strict parser — fails loudly when the LLM returns something we cannot trust.
 * Strips markdown fences if the model added them despite the instructions.
 */
export function parseGeneratorResponse(text: string): AiGeneratorDraft {
  const cleaned = stripFences(text).trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    throw new GeneratorParseError('LLM response was not valid JSON');
  }
  if (!isRecord(raw)) {
    throw new GeneratorParseError('LLM response was not a JSON object');
  }
  const kind = raw['kind'];
  if (typeof kind !== 'string' || !ALLOWED_KINDS.includes(kind as AiGeneratorDraftKind)) {
    throw new GeneratorParseError(`Unsupported kind: ${String(kind)}`);
  }
  if (kind === 'task') return parseTaskDraft(raw);
  if (kind === 'task_with_subtasks') return parseTaskWithSubtasksDraft(raw);
  if (kind === 'doc') return parseDocDraft(raw);
  return parseProjectDraft(raw);
}

function parseTaskDraft(raw: Record<string, unknown>): AiTaskDraft {
  const title = requireString(raw['title'], 'title');
  return {
    kind: 'task',
    title: clampLength(title, 200),
    description: optionalString(raw['description']) ?? null,
    priority: optionalPriority(raw['priority']),
    labels: optionalLabels(raw['labels']),
  };
}

function parseTaskWithSubtasksDraft(
  raw: Record<string, unknown>,
): AiTaskWithSubtasksDraft {
  const parentRaw = raw['parent'];
  if (!isRecord(parentRaw)) {
    throw new GeneratorParseError('Missing parent object on task_with_subtasks');
  }
  const subtasksRaw = raw['subtasks'];
  if (!Array.isArray(subtasksRaw) || subtasksRaw.length === 0) {
    throw new GeneratorParseError('task_with_subtasks requires a non-empty subtasks array');
  }
  const subtasks = subtasksRaw.slice(0, 8).map((entry, index) => {
    if (!isRecord(entry)) {
      throw new GeneratorParseError(`Subtask #${index} is not an object`);
    }
    return {
      title: clampLength(requireString(entry['title'], `subtasks[${index}].title`), 200),
      description: optionalString(entry['description']) ?? null,
    };
  });
  return {
    kind: 'task_with_subtasks',
    parent: {
      title: clampLength(requireString(parentRaw['title'], 'parent.title'), 200),
      description: optionalString(parentRaw['description']) ?? null,
      priority: optionalPriority(parentRaw['priority']),
      labels: optionalLabels(parentRaw['labels']),
    },
    subtasks,
  };
}

function parseDocDraft(raw: Record<string, unknown>): AiDocDraft {
  return {
    kind: 'doc',
    title: clampLength(requireString(raw['title'], 'title'), 200),
    icon: optionalEmoji(raw['icon']),
    body: optionalString(raw['body']) ?? null,
  };
}

function parseProjectDraft(raw: Record<string, unknown>): AiProjectDraft {
  return {
    kind: 'project',
    name: clampLength(requireString(raw['name'], 'name'), 80),
    key: deriveProjectKey(raw['key'], requireString(raw['name'], 'name')),
    description: optionalString(raw['description']) ?? null,
    icon: optionalEmoji(raw['icon']),
    color: optionalHexColor(raw['color']),
  };
}

function deriveProjectKey(rawKey: unknown, name: string): string {
  const candidate = typeof rawKey === 'string' ? rawKey.trim() : '';
  const cleaned = candidate.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (cleaned.length >= 3) return cleaned;
  // Fallback: derive from the name's significant words.
  const words = name
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let derived = words.map((w) => w[0]?.toUpperCase() ?? '').join('');
  if (derived.length < 3 && words[0]) {
    derived = words[0].slice(0, 3).toUpperCase();
  }
  return derived.slice(0, 5) || 'PROJ';
}

function optionalEmoji(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 8) return null;
  return trimmed;
}

function optionalHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toUpperCase() : null;
}

function stripFences(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenceMatch ? fenceMatch[1] : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GeneratorParseError(`Missing required string field: ${field}`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalPriority(value: unknown): TaskPriority | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase() as TaskPriority;
  return ALLOWED_PRIORITIES.has(upper) ? upper : null;
}

function optionalLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
    .slice(0, 5);
}

function clampLength(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export class GeneratorParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeneratorParseError';
  }
}
