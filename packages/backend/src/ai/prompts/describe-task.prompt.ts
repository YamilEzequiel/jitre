export interface DescribeTaskContext {
  taskTitle: string;
  currentDescription?: string | null;
  projectName?: string;
  tone?: 'formal' | 'casual' | 'technical';
}

export function buildDescribeTaskPrompt(ctx: DescribeTaskContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const toneInstruction = {
    formal: 'Use professional, formal language.',
    casual: 'Use friendly, approachable language.',
    technical: 'Use technical, precise language suitable for developers.',
  }[ctx.tone ?? 'technical'];

  const systemPrompt = `You are a project management assistant. Your task is to write clear, concise task descriptions. ${toneInstruction} Keep descriptions under 300 words. Return plain text only.`;

  const lines: string[] = [`Task: ${ctx.taskTitle}`];
  if (ctx.projectName) {
    lines.push(`Project: ${ctx.projectName}`);
  }
  if (ctx.currentDescription) {
    lines.push(`Current description: ${ctx.currentDescription}`);
    lines.push('Please improve and expand the description.');
  } else {
    lines.push('Please write a comprehensive description for this task.');
  }

  return { systemPrompt, userPrompt: lines.join('\n') };
}
