export interface SuggestSubtasksContext {
  taskTitle: string;
  taskDescription?: string | null;
  maxSuggestions: number;
}

export function buildSuggestSubtasksPrompt(ctx: SuggestSubtasksContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are a project management assistant that breaks tasks into subtasks. Return ONLY a valid JSON object with this exact structure: {"subtasks": [{"title": "string", "description": "optional string"}]}. Generate at most ${ctx.maxSuggestions} subtasks.`;

  const lines = [`Main task: ${ctx.taskTitle}`];
  if (ctx.taskDescription) {
    lines.push(`Description: ${ctx.taskDescription}`);
  }
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
  // Try JSON parse first
  try {
    const parsed = JSON.parse(text) as { subtasks?: SubtaskSuggestion[] };
    if (Array.isArray(parsed.subtasks)) {
      return parsed.subtasks.slice(0, maxSuggestions);
    }
  } catch {
    // fall through to lenient parse
  }

  // Lenient markdown fallback: extract bullet points
  const lines = text.split('\n');
  const subtasks: SubtaskSuggestion[] = [];
  for (const line of lines) {
    const match = line.match(/^[-*•]\s+(.+)$/);
    if (match) {
      subtasks.push({ title: match[1].trim() });
      if (subtasks.length >= maxSuggestions) break;
    }
  }

  if (subtasks.length > 0) return subtasks;

  // Both failed — return null (caller handles 502)
  return [];
}
