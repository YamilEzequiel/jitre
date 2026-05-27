import type { AiPromptTemplateEntity } from '../prompt-template/ai-prompt-template.entity';

export interface SuggestSubtasksContext {
  taskTitle: string;
  taskDescription?: string | null;
  maxSuggestions: number;
}

export const SUGGEST_SUBTASKS_TEMPLATE_VARIABLES = [
  'taskTitle',
  'taskDescription',
  'maxSuggestions',
] as const;

function interpolate(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function buildSuggestSubtasksPrompt(
  ctx: SuggestSubtasksContext,
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

  const systemPrompt = `You are a project management assistant that breaks tasks into subtasks. Return ONLY a valid JSON object with this exact structure: {"subtasks": [{"title": "string", "description": "optional string"}]}. Generate at most ${ctx.maxSuggestions} subtasks.`;

  const lines = [`Main task: ${ctx.taskTitle}`];
  if (ctx.taskDescription) lines.push(`Description: ${ctx.taskDescription}`);
  lines.push(`Generate ${ctx.maxSuggestions} subtasks for this task.`);

  return { systemPrompt, userPrompt: lines.join('\n') };
}

export interface SubtaskSuggestion {
  title: string;
  description?: string;
}

/** Parse JSON response; falls back to markdown bullet extraction */
export function parseSubtasksResponse(
  text: string,
  maxSuggestions: number,
): SubtaskSuggestion[] {
  try {
    const parsed = JSON.parse(text) as { subtasks?: SubtaskSuggestion[] };
    if (Array.isArray(parsed.subtasks)) {
      return parsed.subtasks.slice(0, maxSuggestions);
    }
  } catch {
    // fall through
  }

  const lines = text.split('\n');
  const subtasks: SubtaskSuggestion[] = [];
  for (const line of lines) {
    const match = line.match(/^[-*•]\s+(.+)$/);
    if (match) {
      subtasks.push({ title: match[1].trim() });
      if (subtasks.length >= maxSuggestions) break;
    }
  }

  return subtasks;
}
