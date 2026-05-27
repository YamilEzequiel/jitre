import type { AiPromptTemplateEntity } from '../prompt-template/ai-prompt-template.entity';

export interface ExplainTaskContext {
  taskTitle: string;
  taskDescription?: string | null;
  projectName?: string;
}

export const EXPLAIN_TEMPLATE_VARIABLES = [
  'taskTitle',
  'taskDescription',
  'projectName',
] as const;

function interpolate(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? '' : value;
  });
}

/**
 * Build the prompt for a quick 2-sentence explanation of what a task is
 * about, aimed at someone glancing at the list and wondering whether they
 * need to open it. Optionally honors a workspace template — but most
 * installs will stick with the hard-coded default since this surface is
 * meant to be tight and predictable.
 */
export function buildExplainTaskPrompt(
  ctx: ExplainTaskContext,
  template?: Pick<AiPromptTemplateEntity, 'systemPrompt' | 'userTemplate'> | null,
): { systemPrompt: string; userPrompt: string } {
  if (template) {
    const vars = {
      taskTitle: ctx.taskTitle,
      taskDescription: ctx.taskDescription ?? '',
      projectName: ctx.projectName ?? '',
    };
    return {
      systemPrompt: interpolate(template.systemPrompt, vars),
      userPrompt: interpolate(template.userTemplate, vars),
    };
  }

  const systemPrompt =
    'You are a project assistant explaining what a task is about in one short paragraph (max 2 sentences). Be plain, concrete, and avoid filler — pretend you are whispering it to a teammate who has 5 seconds. No headings, no bullet lists, no markdown.';

  const lines = [`Task: ${ctx.taskTitle}`];
  if (ctx.projectName) lines.push(`Project: ${ctx.projectName}`);
  if (ctx.taskDescription) {
    lines.push(`Existing description: ${ctx.taskDescription}`);
  } else {
    lines.push('(No description yet — infer from the title.)');
  }
  lines.push('Explain in 2 sentences what this task is about.');

  return { systemPrompt, userPrompt: lines.join('\n') };
}
