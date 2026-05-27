import type { AiPromptTemplateEntity } from '../prompt-template/ai-prompt-template.entity';

export interface DescribeTaskContext {
  taskTitle: string;
  currentDescription?: string | null;
  projectName?: string;
  tone?: 'formal' | 'casual' | 'technical';
}

/**
 * Variables exposed to the user when authoring a `describe` template.
 * Keep this list in sync with the renderer below so the UI can show
 * the placeholders that work.
 */
export const DESCRIBE_TEMPLATE_VARIABLES = [
  'taskTitle',
  'currentDescription',
  'projectName',
  'tone',
] as const;

function interpolate(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? '' : value;
  });
}

/**
 * Build the (system, user) prompt pair for the describe operation. If
 * `template` is provided we render its system / user text against the
 * call's variables; if not, we fall back to the platform-default
 * heuristic prompt so installs without a template library keep working.
 */
export function buildDescribeTaskPrompt(
  ctx: DescribeTaskContext,
  template?: Pick<AiPromptTemplateEntity, 'systemPrompt' | 'userTemplate'> | null,
): { systemPrompt: string; userPrompt: string } {
  if (template) {
    const vars: Record<string, string | undefined> = {
      taskTitle: ctx.taskTitle,
      currentDescription: ctx.currentDescription ?? '',
      projectName: ctx.projectName ?? '',
      tone: ctx.tone ?? 'technical',
    };
    return {
      systemPrompt: interpolate(template.systemPrompt, vars),
      userPrompt: interpolate(template.userTemplate, vars),
    };
  }

  // Fallback — platform default.
  const toneInstruction = {
    formal: 'Use professional, formal language.',
    casual: 'Use friendly, approachable language.',
    technical: 'Use technical, precise language suitable for developers.',
  }[ctx.tone ?? 'technical'];

  const systemPrompt = `You are a project management assistant. Your task is to write clear, concise task descriptions. ${toneInstruction} Keep descriptions under 300 words. Return plain text only.`;

  const lines: string[] = [`Task: ${ctx.taskTitle}`];
  if (ctx.projectName) lines.push(`Project: ${ctx.projectName}`);
  if (ctx.currentDescription) {
    lines.push(`Current description: ${ctx.currentDescription}`);
    lines.push('Please improve and expand the description.');
  } else {
    lines.push('Please write a comprehensive description for this task.');
  }

  return { systemPrompt, userPrompt: lines.join('\n') };
}
